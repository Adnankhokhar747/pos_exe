import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SupplierInvoiceStatus, SupplierPayment } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { CreateSupplierPaymentDto } from './dto/create-supplier-payment.dto';
import { UpdateSupplierPaymentDto } from './dto/update-supplier-payment.dto';
import { PaymentMismatchError, RecordAlreadyVoidedError } from '../../common/exceptions/domain-exception';

@Injectable()
export class SupplierPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly suppliersService: SuppliersService,
  ) {}

  async findOne(id: string) {
    const payment = await this.prisma.supplierPayment.findUnique({ where: { id }, include: { allocations: true } });
    if (!payment) throw new NotFoundException(`Supplier payment ${id} not found.`);
    return payment;
  }

  async update(id: string, dto: UpdateSupplierPaymentDto): Promise<SupplierPayment> {
    const payment = await this.findOne(id);
    if (payment.voidedAt) throw new RecordAlreadyVoidedError('supplier payment');
    return this.prisma.supplierPayment.update({
      where: { id },
      data: { ...(dto.method !== undefined ? { method: dto.method } : {}) },
    });
  }

  // Reverses each invoice allocation this payment made and re-derives that
  // invoice's paid status from the resulting amountPaid, then reverses the
  // ledger entry so the supplier balance nets back to where it was.
  async void(id: string, voidedBy: string, reason: string): Promise<SupplierPayment> {
    const payment = await this.findOne(id);
    if (payment.voidedAt) throw new RecordAlreadyVoidedError('supplier payment');

    return this.prisma.$transaction(async (tx) => {
      for (const allocation of payment.allocations) {
        const invoice = await tx.supplierInvoice.update({
          where: { id: allocation.supplierInvoiceId },
          data: { amountPaid: { decrement: allocation.amountAllocated } },
        });
        if (!invoice.voidedAt) {
          const status: SupplierInvoiceStatus = invoice.amountPaid.lessThanOrEqualTo(0)
            ? 'unpaid'
            : invoice.amountPaid.gte(invoice.amount)
              ? 'paid'
              : 'partially_paid';
          await tx.supplierInvoice.update({ where: { id: invoice.id }, data: { status } });
        }
      }

      await this.suppliersService.recordLedgerEntry(
        tx,
        payment.supplierId,
        'void_reversal',
        payment.amount,
        'supplier_payments',
        payment.id,
      );

      return tx.supplierPayment.update({
        where: { id },
        data: { voidedAt: new Date(), voidedBy, voidReason: reason },
        include: { allocations: true },
      });
    });
  }

  async create(dto: CreateSupplierPaymentDto): Promise<SupplierPayment> {
    const amount = new Prisma.Decimal(dto.amount);

    return this.prisma.$transaction(async (tx) => {
      const allocations = dto.allocations?.length
        ? dto.allocations.map((allocation) => ({
            supplierInvoiceId: allocation.supplierInvoiceId,
            amount: new Prisma.Decimal(allocation.amount),
          }))
        : await this.fifoAllocate(tx, dto.supplierId, amount);

      const allocatedTotal = allocations.reduce((sum, allocation) => sum.add(allocation.amount), new Prisma.Decimal(0));
      if (allocatedTotal.greaterThan(amount)) {
        throw new PaymentMismatchError(amount.toString(), allocatedTotal.toString());
      }

      const payment = await tx.supplierPayment.create({
        data: {
          supplierId: dto.supplierId,
          amount,
          method: dto.method ?? 'cash',
          allocations: {
            create: allocations.map((allocation) => ({
              supplierInvoiceId: allocation.supplierInvoiceId,
              amountAllocated: allocation.amount,
            })),
          },
        },
      });

      for (const allocation of allocations) {
        const invoice = await tx.supplierInvoice.update({
          where: { id: allocation.supplierInvoiceId },
          data: { amountPaid: { increment: allocation.amount } },
        });
        await tx.supplierInvoice.update({
          where: { id: allocation.supplierInvoiceId },
          data: { status: invoice.amountPaid.gte(invoice.amount) ? 'paid' : 'partially_paid' },
        });
      }

      await this.suppliersService.recordLedgerEntry(
        tx,
        dto.supplierId,
        'payment',
        amount.neg(),
        'supplier_payments',
        payment.id,
      );

      return payment;
    });
  }

  private async fifoAllocate(
    tx: Prisma.TransactionClient,
    supplierId: string,
    amount: Prisma.Decimal,
  ): Promise<Array<{ supplierInvoiceId: string; amount: Prisma.Decimal }>> {
    const openInvoices = await tx.supplierInvoice.findMany({
      where: { supplierId, status: { in: ['unpaid', 'partially_paid'] } },
      orderBy: { createdAt: 'asc' },
    });

    const allocations: Array<{ supplierInvoiceId: string; amount: Prisma.Decimal }> = [];
    let remaining = amount;

    for (const invoice of openInvoices) {
      if (remaining.lessThanOrEqualTo(0)) break;
      const outstanding = invoice.amount.sub(invoice.amountPaid);
      const allocated = Prisma.Decimal.min(outstanding, remaining);
      if (allocated.greaterThan(0)) {
        allocations.push({ supplierInvoiceId: invoice.id, amount: allocated });
        remaining = remaining.sub(allocated);
      }
    }

    return allocations;
  }

  list(supplierId?: string) {
    return this.prisma.supplierPayment.findMany({
      where: supplierId ? { supplierId } : undefined,
      include: { allocations: true },
      orderBy: { paidAt: 'desc' },
      take: 200,
    });
  }
}
