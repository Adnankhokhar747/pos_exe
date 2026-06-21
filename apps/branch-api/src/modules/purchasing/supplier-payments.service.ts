import { Injectable } from '@nestjs/common';
import { Prisma, SupplierPayment } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { CreateSupplierPaymentDto } from './dto/create-supplier-payment.dto';
import { PaymentMismatchError } from '../../common/exceptions/domain-exception';

@Injectable()
export class SupplierPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly suppliersService: SuppliersService,
  ) {}

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
