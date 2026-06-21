import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient, Supplier, SupplierLedgerEntryType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';

type Tx = Prisma.TransactionClient | PrismaClient;

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  create(tenantId: string, dto: CreateSupplierDto): Promise<Supplier> {
    return this.prisma.supplier.create({ data: { tenantId, ...dto } });
  }

  list(tenantId: string, search?: string): Promise<Supplier[]> {
    return this.prisma.supplier.findMany({
      where: {
        tenantId,
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      orderBy: { name: 'asc' },
      take: 200,
    });
  }

  findOne(tenantId: string, id: string): Promise<Supplier | null> {
    return this.prisma.supplier.findFirst({ where: { id, tenantId } });
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
