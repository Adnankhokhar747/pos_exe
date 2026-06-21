import { Injectable } from '@nestjs/common';
import { Prisma, SupplierInvoice } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { CreateSupplierInvoiceDto } from './dto/create-supplier-invoice.dto';

@Injectable()
export class SupplierInvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly suppliersService: SuppliersService,
  ) {}

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
