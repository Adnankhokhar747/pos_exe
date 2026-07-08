import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SupplierInvoice } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { CreateSupplierInvoiceDto } from './dto/create-supplier-invoice.dto';
import { UpdateSupplierInvoiceDto } from './dto/update-supplier-invoice.dto';
import { RecordAlreadyVoidedError, SupplierInvoiceNotVoidableError } from '../../common/exceptions/domain-exception';

@Injectable()
export class SupplierInvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly suppliersService: SuppliersService,
  ) {}

  async findOne(id: string) {
    const invoice = await this.prisma.supplierInvoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException(`Supplier invoice ${id} not found.`);
    return invoice;
  }

  async update(id: string, dto: UpdateSupplierInvoiceDto): Promise<SupplierInvoice> {
    const invoice = await this.findOne(id);
    if (invoice.voidedAt) throw new RecordAlreadyVoidedError('supplier invoice');
    return this.prisma.supplierInvoice.update({
      where: { id },
      data: {
        ...(dto.invoiceNo !== undefined ? { invoiceNo: dto.invoiceNo } : {}),
        ...(dto.dueDate !== undefined ? { dueDate: new Date(dto.dueDate) } : {}),
      },
    });
  }

  async void(id: string, voidedBy: string, reason: string): Promise<SupplierInvoice> {
    const invoice = await this.findOne(id);
    if (invoice.voidedAt) throw new RecordAlreadyVoidedError('supplier invoice');
    if (invoice.amountPaid.greaterThan(0)) {
      throw new SupplierInvoiceNotVoidableError('payments have already been allocated to it — void those payments first');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.suppliersService.recordLedgerEntry(
        tx,
        invoice.supplierId,
        'void_reversal',
        invoice.amount.neg(),
        'supplier_invoices',
        invoice.id,
      );
      return tx.supplierInvoice.update({
        where: { id },
        data: { status: 'voided', voidedAt: new Date(), voidedBy, voidReason: reason },
      });
    });
  }

  async create(dto: CreateSupplierInvoiceDto): Promise<SupplierInvoice> {
    return this.prisma.$transaction(async (tx) => {
      const amount = new Prisma.Decimal(dto.amount);
      const invoice = await tx.supplierInvoice.create({
        data: {
          supplierId: dto.supplierId,
          goodsReceiptId: dto.goodsReceiptId,
          invoiceNo: dto.invoiceNo,
          amount,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        },
      });

      await this.suppliersService.recordLedgerEntry(
        tx,
        dto.supplierId,
        'purchase_invoice',
        amount,
        'supplier_invoices',
        invoice.id,
      );

      return invoice;
    });
  }

  list(supplierId?: string) {
    return this.prisma.supplierInvoice.findMany({
      where: supplierId ? { supplierId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
