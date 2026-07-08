import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient, Supplier, SupplierLedgerEntryType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

type Tx = Prisma.TransactionClient | PrismaClient;

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  create(tenantId: string, dto: CreateSupplierDto): Promise<Supplier> {
    return this.prisma.supplier.create({ data: { tenantId, ...dto } });
  }

  list(tenantId: string, search?: string, includeInactive = false): Promise<Supplier[]> {
    return this.prisma.supplier.findMany({
      where: {
        tenantId,
        ...(includeInactive ? {} : { isActive: true }),
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      orderBy: { name: 'asc' },
      take: 200,
    });
  }

  findOne(tenantId: string, id: string): Promise<Supplier | null> {
    return this.prisma.supplier.findFirst({ where: { id, tenantId } });
  }

  // Same tenant-scoping gap as products.service.ts: tenantId was accepted but never
  // applied to the query, so this was only safe by virtue of the controller
  // pre-checking ownership via findOne() first. updateMany() + a count check makes
  // the service correct on its own.
  async update(tenantId: string, id: string, dto: UpdateSupplierDto): Promise<Supplier> {
    const { count } = await this.prisma.supplier.updateMany({ where: { id, tenantId }, data: { ...dto } });
    if (count === 0) throw new NotFoundException(`Supplier ${id} not found.`);
    return this.prisma.supplier.findUniqueOrThrow({ where: { id } });
  }

  async deactivate(tenantId: string, id: string): Promise<Supplier> {
    const { count } = await this.prisma.supplier.updateMany({ where: { id, tenantId }, data: { isActive: false } });
    if (count === 0) throw new NotFoundException(`Supplier ${id} not found.`);
    return this.prisma.supplier.findUniqueOrThrow({ where: { id } });
  }

  getLedger(supplierId: string) {
    return this.prisma.supplierLedgerEntry.findMany({
      where: { supplierId },
      orderBy: { occurredAt: 'desc' },
    });
  }

  // Mirrors CustomersService.recordLedgerEntry — see docs/00-functional-specification.md §12.
  async recordLedgerEntry(
    tx: Tx,
    supplierId: string,
    entryType: SupplierLedgerEntryType,
    amount: Prisma.Decimal,
    referenceTable?: string,
    referenceId?: string,
  ): Promise<void> {
    const supplier = await tx.supplier.update({
      where: { id: supplierId },
      data: { currentBalance: { increment: amount } },
    });

    await tx.supplierLedgerEntry.create({
      data: {
        supplierId,
        entryType,
        amount,
        balanceAfter: supplier.currentBalance,
        referenceTable,
        referenceId,
      },
    });
  }
}
