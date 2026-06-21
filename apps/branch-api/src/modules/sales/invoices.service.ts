import { Injectable } from '@nestjs/common';
import { Invoice, PaymentMethod, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { HoldInvoiceDto } from './dto/hold-invoice.dto';
import { CreateReturnDto } from './dto/create-return.dto';
import {
  InsufficientStockError,
  InvoiceAlreadyVoidedError,
  PaymentMismatchError,
} from '../../common/exceptions/domain-exception';
import { CustomersService } from '../customers/customers.service';

const ZERO = new Prisma.Decimal(0);
// Payment totals are compared after rounding to the currency's minor unit to absorb
// floating-point-free but still non-exact decimal division (e.g. split payments).
const PAYMENT_TOLERANCE = new Prisma.Decimal('0.01');

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
  ) {}

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

    const creditAmount = dto.payments
      .filter((payment) => payment.method === 'credit_sale')
      .reduce((sum, payment) => sum.add(new Prisma.Decimal(payment.amount)), ZERO);

    const invoiceNo = await this.nextInvoiceNumber(dto.branchId);

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          branchId: dto.branchId,
          invoiceNo,
          invoiceType: 'sale',
          status: 'completed',
          customerId: dto.customerId,
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

      if (dto.customerId && creditAmount.greaterThan(0)) {
        await this.customersService.recordLedgerEntry(tx, dto.customerId, 'invoice', creditAmount, 'invoices', invoice.id);
      }

      return invoice;
    });
  }

  async holdInvoice(branchId: string, cashierId: string, dto: HoldInvoiceDto): Promise<Invoice> {
    const invoiceNo = await this.nextInvoiceNumber(branchId);
    return this.prisma.invoice.create({
      data: {
        branchId,
        invoiceNo,
        invoiceType: 'sale',
        status: 'held',
        customerId: dto.customerId,
        heldLabel: dto.heldLabel,
        cashierId,
        lines: {
          create: dto.lines.map((line) => ({
            productId: line.productId,
            quantity: new Prisma.Decimal(line.quantity),
            unitPrice: new Prisma.Decimal(line.unitPrice),
            discountValue: line.discountValue ? new Prisma.Decimal(line.discountValue) : ZERO,
            taxAmount: ZERO,
            lineTotal: new Prisma.Decimal(line.quantity).mul(new Prisma.Decimal(line.unitPrice)),
          })),
        },
      },
      include: { lines: true },
    });
  }

  listHeld(branchId: string) {
    return this.prisma.invoice.findMany({
      where: { branchId, status: 'held' },
      include: { lines: { include: { product: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Resuming a held invoice hands its cart contents back to the client to
  // continue editing; the held row is then discarded — completion always
  // goes through createInvoice() so stock/payment logic has exactly one
  // implementation (docs/00-functional-specification.md §8.2).
  async resumeInvoice(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUniqueOrThrow({
        where: { id },
        include: { lines: { include: { product: true } } },
      });
      await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
      await tx.invoice.delete({ where: { id } });
      return invoice;
    });
  }

  async voidInvoice(id: string, voidedBy: string, reason: string): Promise<Invoice> {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id }, include: { lines: true } });
      if (invoice.status === 'voided') {
        throw new InvoiceAlreadyVoidedError(id);
      }

      const ledgerEntries = await tx.stockLedgerEntry.findMany({
        where: { referenceTable: 'invoices', referenceId: id, movementType: 'sale' },
      });

      for (const entry of ledgerEntries) {
        const restockQty = entry.quantityDelta.neg();
        await tx.stockLedgerEntry.create({
          data: {
            warehouseId: entry.warehouseId,
            productId: entry.productId,
            movementType: 'sale_return',
            quantityDelta: restockQty,
            unitCostAtMove: entry.unitCostAtMove,
            referenceTable: 'invoices',
            referenceId: id,
          },
        });
        await tx.stockLevel.update({
          where: { warehouseId_productId: { warehouseId: entry.warehouseId, productId: entry.productId } },
          data: { quantityOnHand: { increment: restockQty } },
        });
      }

      if (invoice.customerId) {
        await this.customersService.recordLedgerEntry(tx, invoice.customerId, 'return', invoice.grandTotal.neg(), 'invoices', id);
      }

      return tx.invoice.update({
        where: { id },
        data: { status: 'voided', voidReason: reason, voidedBy, voidedAt: new Date() },
      });
    });
  }

  // Supports full or partial return: each requested line restocks the warehouse
  // the original sale was fulfilled from (recovered from that line's own stock
  // ledger entry) and the refund total is computed proportionally to the
  // quantity actually being returned, not just copied from the original line.
  async createReturn(branchId: string, processedBy: string, originalInvoiceId: string, dto: CreateReturnDto): Promise<Invoice> {
    return this.prisma.$transaction(async (tx) => {
      const original = await tx.invoice.findUniqueOrThrow({
        where: { id: originalInvoiceId },
        include: { lines: { include: { product: true } } },
      });

      let subtotal = ZERO;
      let taxTotal = ZERO;
      const returnLineData: Array<{
        productId: string;
        quantity: Prisma.Decimal;
        unitPrice: Prisma.Decimal;
        taxAmount: Prisma.Decimal;
        lineTotal: Prisma.Decimal;
        originalInvoiceLineId: string;
        warehouseEntry: { warehouseId: string; unitCostAtMove: Prisma.Decimal };
      }> = [];

      for (const requested of dto.lines) {
        const originalLine = original.lines.find((line) => line.id === requested.invoiceLineId);
        if (!originalLine) continue;

        const returnQty = new Prisma.Decimal(requested.quantity);
        const proportion = returnQty.div(originalLine.quantity);
        const lineSubtotal = originalLine.quantity.mul(originalLine.unitPrice).mul(proportion);
        const lineTax = originalLine.taxAmount.mul(proportion);

        const saleEntry = await tx.stockLedgerEntry.findFirst({
          where: { referenceTable: 'invoices', referenceId: original.id, productId: originalLine.productId, movementType: 'sale' },
        });

        subtotal = subtotal.add(lineSubtotal);
        taxTotal = taxTotal.add(lineTax);
        returnLineData.push({
          productId: originalLine.productId,
          quantity: returnQty,
          unitPrice: originalLine.unitPrice,
          taxAmount: lineTax,
          lineTotal: lineSubtotal.add(lineTax),
          originalInvoiceLineId: originalLine.id,
          warehouseEntry: {
            warehouseId: saleEntry?.warehouseId ?? '',
            unitCostAtMove: saleEntry?.unitCostAtMove ?? ZERO,
          },
        });
      }

      const grandTotal = subtotal.add(taxTotal);
      const returnInvoiceNo = await this.nextInvoiceNumber(branchId);

      const returnInvoice = await tx.invoice.create({
        data: {
          branchId,
          invoiceNo: returnInvoiceNo,
          invoiceType: 'return',
          status: 'completed',
          customerId: original.customerId,
          originalInvoiceId: original.id,
          subtotal,
          taxTotal,
          grandTotal,
          cashierId: processedBy,
          lines: {
            create: returnLineData.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              taxAmount: line.taxAmount,
              lineTotal: line.lineTotal,
              originalInvoiceLineId: line.originalInvoiceLineId,
            })),
          },
          payments: {
            create: [{ method: (dto.refundMethod ?? 'cash') as PaymentMethod, amount: grandTotal }],
          },
        },
      });

      for (const line of returnLineData) {
        if (!line.warehouseEntry.warehouseId) continue;
        await tx.stockLedgerEntry.create({
          data: {
            warehouseId: line.warehouseEntry.warehouseId,
            productId: line.productId,
            movementType: 'sale_return',
            quantityDelta: line.quantity,
            unitCostAtMove: line.warehouseEntry.unitCostAtMove,
            referenceTable: 'invoices',
            referenceId: returnInvoice.id,
          },
        });
        await tx.stockLevel.upsert({
          where: { warehouseId_productId: { warehouseId: line.warehouseEntry.warehouseId, productId: line.productId } },
          update: { quantityOnHand: { increment: line.quantity } },
          create: { warehouseId: line.warehouseEntry.warehouseId, productId: line.productId, quantityOnHand: line.quantity },
        });
      }

      if (original.customerId) {
        await this.customersService.recordLedgerEntry(tx, original.customerId, 'return', grandTotal.neg(), 'invoices', returnInvoice.id);
      }

      return returnInvoice;
    });
  }

  private async nextInvoiceNumber(branchId: string): Promise<string> {
    const count = await this.prisma.invoice.count({ where: { branchId } });
    return `INV-${String(count + 1).padStart(6, '0')}`;
  }
}
