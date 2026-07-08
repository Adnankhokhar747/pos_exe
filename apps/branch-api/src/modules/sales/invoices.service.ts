import { Injectable, NotFoundException } from '@nestjs/common';
import { Coupon, Invoice, PaymentMethod, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInvoiceDto, InvoiceLineDto } from './dto/create-invoice.dto';
import { HoldInvoiceDto } from './dto/hold-invoice.dto';
import { CreateReturnDto } from './dto/create-return.dto';
import {
  InsufficientBatchStockError,
  InsufficientPatientBalanceError,
  InsufficientStockError,
  InvalidGiftCardError,
  InvalidPatientAdvancePaymentError,
  InvoiceAlreadyVoidedError,
  PaymentMismatchError,
  SerialNumberUnavailableError,
} from '../../common/exceptions/domain-exception';
import { CustomersService } from '../customers/customers.service';
import { CouponsService } from './coupons.service';
import { GiftCardsService } from './gift-cards.service';
import { CurrenciesService } from '../settings/currencies.service';
import { LicenseStatusService } from '../licensing/license-status.service';

const ZERO = new Prisma.Decimal(0);
// Payment totals are compared after rounding to the currency's minor unit to absorb
// floating-point-free but still non-exact decimal division (e.g. split payments).
const PAYMENT_TOLERANCE = new Prisma.Decimal('0.01');

type Tx = Prisma.TransactionClient;

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
    private readonly couponsService: CouponsService,
    private readonly giftCardsService: GiftCardsService,
    private readonly currenciesService: CurrenciesService,
    private readonly licenseStatusService: LicenseStatusService,
  ) {}

  async createInvoice(tenantId: string, cashierId: string, dto: CreateInvoiceDto): Promise<Invoice> {
    await this.licenseStatusService.checkInvoiceLimit(tenantId);

    const productIds = dto.lines.map((line) => line.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, tenantId },
      include: { taxTemplate: true, bundleComponentOf: { include: { componentProduct: true } } },
    });
    const productById = new Map(products.map((product) => [product.id, product]));

    // Bundle lines are virtual: they expand to their components for stock purposes
    // instead of being stocked items themselves.
    const stockCheckProductIds = new Set<string>();
    for (const product of products) {
      if (product.isBundle) {
        for (const bc of product.bundleComponentOf) stockCheckProductIds.add(bc.componentProductId);
      } else {
        stockCheckProductIds.add(product.id);
      }
    }
    const stockLevels = await this.prisma.stockLevel.findMany({
      where: { warehouseId: dto.warehouseId, productId: { in: Array.from(stockCheckProductIds) } },
    });
    const stockByProduct = new Map(stockLevels.map((stock) => [stock.productId, stock.quantityOnHand]));

    let subtotal = ZERO;
    let discountTotal = ZERO;
    let taxTotal = ZERO;
    let lineTotalSum = ZERO;

    const computedLines = dto.lines.map((line) => {
      const product = productById.get(line.productId);
      if (!product) throw new InsufficientStockError(line.productId, '0', line.quantity);

      const quantity = new Prisma.Decimal(line.quantity);
      const unitPrice = new Prisma.Decimal(line.unitPrice);
      const discountValue = line.discountValue ? new Prisma.Decimal(line.discountValue) : ZERO;

      if (product.isBundle) {
        for (const bc of product.bundleComponentOf) {
          const requiredQty = bc.quantity.mul(quantity);
          const available = stockByProduct.get(bc.componentProductId) ?? ZERO;
          if (available.lessThan(requiredQty)) {
            throw new InsufficientStockError(bc.componentProductId, available.toString(), requiredQty.toString());
          }
        }
      } else {
        const available = stockByProduct.get(line.productId) ?? ZERO;
        if (available.lessThan(quantity)) {
          throw new InsufficientStockError(line.productId, available.toString(), quantity.toString());
        }
      }

      const lineGross = quantity.mul(unitPrice);
      const lineNet = lineGross.sub(discountValue);

      const activeTemplate = product.taxTemplate?.isActive ? product.taxTemplate : null;
      const ratePct = activeTemplate ? activeTemplate.ratePct : product.taxRatePct;
      const isInclusive = activeTemplate ? activeTemplate.isInclusive : false;

      let taxAmount: Prisma.Decimal;
      let lineTotal: Prisma.Decimal;
      if (isInclusive) {
        taxAmount = lineNet.mul(ratePct).div(new Prisma.Decimal(100).add(ratePct));
        lineTotal = lineNet;
      } else {
        taxAmount = lineNet.mul(ratePct).div(100);
        lineTotal = lineNet.add(taxAmount);
      }

      subtotal = subtotal.add(lineGross);
      discountTotal = discountTotal.add(discountValue);
      taxTotal = taxTotal.add(taxAmount);
      lineTotalSum = lineTotalSum.add(lineTotal);

      return { line, product, quantity, unitPrice, discountValue, taxAmount, lineTotal };
    });

    const invoiceDiscount = dto.invoiceDiscountValue ? new Prisma.Decimal(dto.invoiceDiscountValue) : ZERO;
    discountTotal = discountTotal.add(invoiceDiscount);
    let grandTotal = lineTotalSum.sub(invoiceDiscount);

    let couponRecord: Coupon | null = null;
    let couponDiscountAmount = ZERO;
    if (dto.couponCode) {
      const { coupon, discount } = await this.couponsService.validate(tenantId, dto.couponCode, grandTotal);
      couponRecord = coupon;
      couponDiscountAmount = discount;
      discountTotal = discountTotal.add(couponDiscountAmount);
      grandTotal = grandTotal.sub(couponDiscountAmount);
    }

    let loyaltyPointsRedeemed = ZERO;
    if (dto.loyaltyPointsToRedeem && dto.customerId) {
      const requestedPoints = new Prisma.Decimal(dto.loyaltyPointsToRedeem);
      if (requestedPoints.greaterThan(0)) {
        await this.customersService.assertSufficientPoints(tenantId, dto.customerId, requestedPoints);
        let loyaltyDiscount = this.customersService.redemptionDiscountFor(requestedPoints);
        loyaltyPointsRedeemed = requestedPoints;
        if (loyaltyDiscount.greaterThan(grandTotal)) {
          loyaltyDiscount = grandTotal;
          loyaltyPointsRedeemed = loyaltyDiscount.div(this.customersService.redemptionDiscountFor(new Prisma.Decimal(1)));
        }
        discountTotal = discountTotal.add(loyaltyDiscount);
        grandTotal = grandTotal.sub(loyaltyDiscount);
      }
    }

    let exchangeRateToBase: Prisma.Decimal | undefined;
    if (dto.currencyCode) {
      const rate = await this.currenciesService.latestRate(dto.currencyCode);
      exchangeRateToBase = rate?.rateToBase;
    }

    const paymentsTotal = dto.payments.reduce((sum, payment) => sum.add(new Prisma.Decimal(payment.amount)), ZERO);
    if (paymentsTotal.sub(grandTotal).abs().greaterThan(PAYMENT_TOLERANCE)) {
      throw new PaymentMismatchError(grandTotal.toString(), paymentsTotal.toString());
    }

    const creditAmount = dto.payments
      .filter((payment) => payment.method === 'credit_sale')
      .reduce((sum, payment) => sum.add(new Prisma.Decimal(payment.amount)), ZERO);

    // Earned on the final, post-discount/coupon/redemption grandTotal — computed here
    // (rather than after the invoice row is created) so it can go straight into the
    // create() call instead of needing a follow-up update whose result would otherwise
    // be discarded by the stale in-memory `invoice` object returned from the transaction.
    const loyaltyPointsEarned = dto.customerId ? this.customersService.earnedPointsFor(grandTotal) : ZERO;

    const invoiceNo = await this.nextInvoiceNumber(dto.branchId);

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          branchId: dto.branchId,
          invoiceNo,
          invoiceType: 'sale',
          status: 'completed',
          customerId: dto.customerId,
          patientId: dto.patientId,
          subtotal,
          discountTotal,
          taxTotal,
          grandTotal,
          cashierId,
          currencyCode: dto.currencyCode,
          exchangeRateToBase,
          couponCode: couponRecord?.code,
          couponDiscountAmount,
          loyaltyPointsRedeemed,
          loyaltyPointsEarned,
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
        include: { lines: true },
      }) as Invoice & { lines: { id: string; productId: string }[] };

      for (let i = 0; i < computedLines.length; i++) {
        const { line, product, quantity } = computedLines[i]!;
        const createdLine = invoice.lines[i]!;

        if (product.isBundle) {
          for (const bc of product.bundleComponentOf) {
            const requiredQty = bc.quantity.mul(quantity);
            await this.decrementStock(tx, dto.warehouseId, bc.componentProductId, requiredQty, bc.componentProduct.costPrice, invoice.id);
          }
        } else {
          await this.decrementStock(tx, dto.warehouseId, line.productId, quantity, product.costPrice, invoice.id);
          if (product.trackBatches) {
            await this.consumeBatchesFifo(tx, dto.warehouseId, line.productId, quantity, createdLine.id);
          }
          if (product.trackSerials) {
            await this.consumeSerials(tx, line.productId, dto.warehouseId, line.serialNumbers ?? [], createdLine.id);
          }
        }
      }

      if (dto.customerId && creditAmount.greaterThan(0)) {
        await this.customersService.recordLedgerEntry(tx, dto.customerId, 'invoice', creditAmount, 'invoices', invoice.id);
      }

      for (const payment of dto.payments) {
        if (payment.method === 'gift_card') {
          if (!payment.reference) throw new InvalidGiftCardError('(none)', 'missing gift card code');
          await this.giftCardsService.redeem(tx, tenantId, payment.reference, new Prisma.Decimal(payment.amount));
        }
        if (payment.method === 'patient_advance') {
          if (!dto.patientId) {
            throw new InvalidPatientAdvancePaymentError('A patient must be selected before using patient advance.');
          }
          const patient = await tx.patient.findFirst({ where: { id: dto.patientId, tenantId } });
          if (!patient) {
            throw new InvalidPatientAdvancePaymentError('Selected patient was not found for this tenant.');
          }
          const deduct = new Prisma.Decimal(payment.amount);
          if (patient.currentBalance.lessThan(deduct)) {
            throw new InsufficientPatientBalanceError(patient.currentBalance.toString(), deduct.toString());
          }
          const newBalance = new Prisma.Decimal(patient.currentBalance).sub(deduct);
          await tx.patient.update({ where: { id: dto.patientId }, data: { currentBalance: newBalance } });
          await tx.patientLedgerEntry.create({
            data: {
              tenantId,
              patientId: dto.patientId,
              entryType: 'pos_sale',
              amount: deduct.neg(),
              balanceAfter: newBalance,
              description: `POS sale — Invoice #${invoice.invoiceNo}`,
              createdBy: cashierId,
            },
          });
        }
      }

      if (couponRecord) {
        await this.couponsService.consume(tx, couponRecord.id);
      }

      if (dto.customerId) {
        if (loyaltyPointsEarned.greaterThan(0)) {
          await this.customersService.recordLoyaltyEntry(tx, dto.customerId, 'earn', loyaltyPointsEarned, 'invoices', invoice.id);
        }
        if (loyaltyPointsRedeemed.greaterThan(0)) {
          await this.customersService.recordLoyaltyEntry(tx, dto.customerId, 'redeem', loyaltyPointsRedeemed.neg(), 'invoices', invoice.id);
        }
      }

      return invoice;
    });
  }

  private async decrementStock(
    tx: Tx,
    warehouseId: string,
    productId: string,
    quantity: Prisma.Decimal,
    unitCost: Prisma.Decimal,
    invoiceId: string,
  ): Promise<void> {
    await tx.stockLedgerEntry.create({
      data: {
        warehouseId,
        productId,
        movementType: 'sale',
        quantityDelta: quantity.neg(),
        unitCostAtMove: unitCost,
        referenceTable: 'invoices',
        referenceId: invoiceId,
      },
    });
    await tx.stockLevel.update({
      where: { warehouseId_productId: { warehouseId, productId } },
      data: { quantityOnHand: { decrement: quantity } },
    });
  }

  // Allocates the sale against the oldest-expiring batches first, so the stock most at
  // risk of expiring unsold is always consumed before fresher stock (docs §"Batch Tracking").
  private async consumeBatchesFifo(
    tx: Tx,
    warehouseId: string,
    productId: string,
    quantity: Prisma.Decimal,
    invoiceLineId: string,
  ): Promise<void> {
    const batches = await tx.batch.findMany({
      where: { warehouseId, productId, quantityOnHand: { gt: 0 } },
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
    });

    let remaining = quantity;
    for (const batch of batches) {
      if (remaining.lessThanOrEqualTo(0)) break;
      const consume = Prisma.Decimal.min(remaining, batch.quantityOnHand);
      await tx.batch.update({ where: { id: batch.id }, data: { quantityOnHand: { decrement: consume } } });
      await tx.invoiceLineBatch.create({ data: { invoiceLineId, batchId: batch.id, quantity: consume } });
      remaining = remaining.sub(consume);
    }

    if (remaining.greaterThan(0)) {
      const totalAvailable = batches.reduce((sum, b) => sum.add(b.quantityOnHand), ZERO);
      throw new InsufficientBatchStockError(productId, totalAvailable.toString(), quantity.toString());
    }
  }

  private async consumeSerials(
    tx: Tx,
    productId: string,
    warehouseId: string,
    serialNumbers: string[],
    invoiceLineId: string,
  ): Promise<void> {
    for (const serialNo of serialNumbers) {
      const serial = await tx.serialNumber.findFirst({
        where: { productId, warehouseId, serialNo, status: 'in_stock' },
      });
      if (!serial) throw new SerialNumberUnavailableError(serialNo);
      await tx.serialNumber.update({
        where: { id: serial.id },
        data: { status: 'sold', invoiceLineId },
      });
    }
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
  // Both resumeInvoice and voidInvoice previously fetched by raw id with no
  // tenant check at all (neither here nor in the controller) — any
  // authenticated user holding the relevant permission could resume-delete or
  // void an invoice belonging to a completely different company just by
  // knowing/guessing its UUID. Scoping through the branch relation closes that.
  async resumeInvoice(tenantId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id, branch: { tenantId } },
        include: { lines: { include: { product: true } } },
      });
      if (!invoice) throw new NotFoundException(`Invoice ${id} not found.`);
      await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
      await tx.invoice.delete({ where: { id } });
      return invoice;
    });
  }

  async voidInvoice(tenantId: string, id: string, voidedBy: string, reason: string): Promise<Invoice> {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({ where: { id, branch: { tenantId } }, include: { lines: true, payments: true } });
      if (!invoice) throw new NotFoundException(`Invoice ${id} not found.`);
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

      // Reverse batch and serial allocations so void is a full inventory undo, not
      // just a StockLevel-level one.
      const lineIds = invoice.lines.map((line) => line.id);
      const batchAllocations = await tx.invoiceLineBatch.findMany({ where: { invoiceLineId: { in: lineIds } } });
      for (const allocation of batchAllocations) {
        await tx.batch.update({ where: { id: allocation.batchId }, data: { quantityOnHand: { increment: allocation.quantity } } });
      }
      await tx.serialNumber.updateMany({
        where: { invoiceLineId: { in: lineIds }, status: 'sold' },
        data: { status: 'in_stock', invoiceLineId: null },
      });

      if (invoice.customerId) {
        await this.customersService.recordLedgerEntry(tx, invoice.customerId, 'return', invoice.grandTotal.neg(), 'invoices', id);
        if (invoice.loyaltyPointsEarned.greaterThan(0)) {
          await this.customersService.recordLoyaltyEntry(
            tx,
            invoice.customerId,
            'adjustment',
            invoice.loyaltyPointsEarned.neg(),
            'invoices',
            id,
          );
        }
        if (invoice.loyaltyPointsRedeemed.greaterThan(0)) {
          await this.customersService.recordLoyaltyEntry(
            tx,
            invoice.customerId,
            'adjustment',
            invoice.loyaltyPointsRedeemed,
            'invoices',
            id,
          );
        }
      }

      const patientAdvanceRefund = invoice.payments
        .filter((payment) => payment.method === 'patient_advance')
        .reduce((sum, payment) => sum.add(payment.amount), ZERO);
      if (invoice.patientId && patientAdvanceRefund.greaterThan(0)) {
        const patient = await tx.patient.findUniqueOrThrow({ where: { id: invoice.patientId } });
        const newBalance = patient.currentBalance.add(patientAdvanceRefund);
        await tx.patient.update({ where: { id: invoice.patientId }, data: { currentBalance: newBalance } });
        await tx.patientLedgerEntry.create({
          data: {
            tenantId: patient.tenantId,
            patientId: invoice.patientId,
            entryType: 'pos_void',
            amount: patientAdvanceRefund,
            balanceAfter: newBalance,
            description: `POS void refund — Invoice #${invoice.invoiceNo}`,
            createdBy: voidedBy,
          },
        });
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
  // Note: bundle-sale lines are not decomposed back into per-component restocks here
  // (their stock ledger entries are keyed by component productId, not the bundle's),
  // so a bundle return is a financial-only reversal; full component restocking on
  // bundle returns is a known gap, not yet implemented.
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
