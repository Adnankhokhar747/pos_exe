import { Injectable } from '@nestjs/common';
import { Invoice, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InsufficientStockError, PaymentMismatchError } from '../../common/exceptions/domain-exception';

const ZERO = new Prisma.Decimal(0);
// Payment totals are compared after rounding to the currency's minor unit to absorb
// floating-point-free but still non-exact decimal division (e.g. split payments).
const PAYMENT_TOLERANCE = new Prisma.Decimal('0.01');

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async createInvoice(tenantId: string, cashierId: string, dto: CreateInvoiceDto): Promise<Invoice> {
    const productIds = dto.lines.map((line) => line.productId);
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds }, tenantId } });
    const productById = new Map(products.map((product) => [product.id, product]));

    const stockLevels = await this.prisma.stockLevel.findMany({
      where: { warehouseId: dto.warehouseId, productId: { in: productIds } },
    });
    const stockByProduct = new Map(stockLevels.map((stock) => [stock.productId, stock]));

    let subtotal = ZERO;
    let discountTotal = ZERO;
    let taxTotal = ZERO;

    const computedLines = dto.lines.map((line) => {
      const product = productById.get(line.productId);
      if (!product) throw new InsufficientStockError(line.productId, '0', line.quantity);

      const quantity = new Prisma.Decimal(line.quantity);
      const unitPrice = new Prisma.Decimal(line.unitPrice);
      const discountValue = line.discountValue ? new Prisma.Decimal(line.discountValue) : ZERO;

      const available = stockByProduct.get(line.productId)?.quantityOnHand ?? ZERO;
      if (available.lessThan(quantity)) {
        throw new InsufficientStockError(line.productId, available.toString(), quantity.toString());
      }

      const lineGross = quantity.mul(unitPrice);
      const lineNet = lineGross.sub(discountValue);
      const taxAmount = lineNet.mul(product.taxRatePct).div(100);
      const lineTotal = lineNet.add(taxAmount);

      subtotal = subtotal.add(lineGross);
      discountTotal = discountTotal.add(discountValue);
      taxTotal = taxTotal.add(taxAmount);

      return { line, product, quantity, unitPrice, discountValue, taxAmount, lineTotal };
    });

    const invoiceDiscount = dto.invoiceDiscountValue ? new Prisma.Decimal(dto.invoiceDiscountValue) : ZERO;
    discountTotal = discountTotal.add(invoiceDiscount);
    const grandTotal = subtotal.sub(discountTotal).add(taxTotal);

    const paymentsTotal = dto.payments.reduce((sum, payment) => sum.add(new Prisma.Decimal(payment.amount)), ZERO);
    if (paymentsTotal.sub(grandTotal).abs().greaterThan(PAYMENT_TOLERANCE)) {
      throw new PaymentMismatchError(grandTotal.toString(), paymentsTotal.toString());
    }

    const invoiceNo = await this.nextInvoiceNumber(dto.branchId);

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          branchId: dto.branchId,
          invoiceNo,
          status: 'completed',
          subtotal,
          discountTotal,
          taxTotal,
          grandTotal,
          cashierId,
          lines: {
            create: computedLines.map(({ line, quantity, unitPrice, discountValue, taxAmount, lineTotal }) => ({
              productId: line.productId,
              quantity,
              unitPrice,
              discountValue,
              taxAmount,
              lineTotal,
            })),
          },
          payments: {
            create: dto.payments.map((payment) => ({
              method: payment.method,
              amount: new Prisma.Decimal(payment.amount),
              receivedAmount: payment.receivedAmount ? new Prisma.Decimal(payment.receivedAmount) : undefined,
              changeAmount: payment.receivedAmount
                ? new Prisma.Decimal(payment.receivedAmount).sub(new Prisma.Decimal(payment.amount))
                : undefined,
              reference: payment.reference,
            })),
          },
        },
      });

      for (const { line, product, quantity } of computedLines) {
        await tx.stockLedgerEntry.create({
          data: {
            warehouseId: dto.warehouseId,
            productId: line.productId,
            movementType: 'sale',
            quantityDelta: quantity.neg(),
            unitCostAtMove: product.costPrice,
            referenceTable: 'invoices',
            referenceId: invoice.id,
          },
        });

        await tx.stockLevel.update({
          where: { warehouseId_productId: { warehouseId: dto.warehouseId, productId: line.productId } },
          data: { quantityOnHand: { decrement: quantity } },
        });
      }

      return invoice;
    });
  }

  private async nextInvoiceNumber(branchId: string): Promise<string> {
    const count = await this.prisma.invoice.count({ where: { branchId } });
    return `INV-${String(count + 1).padStart(6, '0')}`;
  }
}
