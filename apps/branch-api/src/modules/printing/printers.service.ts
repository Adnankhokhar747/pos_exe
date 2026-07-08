import { Injectable, NotFoundException } from '@nestjs/common';
import { Printer } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertPrinterDto } from './dto/upsert-printer.dto';

@Injectable()
export class PrintersService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, branchId: string): Promise<Printer[]> {
    return this.prisma.printer.findMany({ where: { tenantId, branchId }, orderBy: { name: 'asc' } });
  }

  findOne(tenantId: string, id: string): Promise<Printer | null> {
    return this.prisma.printer.findFirst({ where: { id, tenantId } });
  }

  create(tenantId: string, branchId: string, dto: UpsertPrinterDto): Promise<Printer> {
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefaultReceipt) {
        await tx.printer.updateMany({ where: { tenantId, branchId }, data: { isDefaultReceipt: false } });
      }
      if (dto.isDefaultInvoice) {
        await tx.printer.updateMany({ where: { tenantId, branchId }, data: { isDefaultInvoice: false } });
      }
      return tx.printer.create({
        data: {
          tenantId,
          branchId,
          name: dto.name,
          type: dto.type,
          systemPrinterName: dto.systemPrinterName,
          isDefaultReceipt: dto.isDefaultReceipt ?? false,
          isDefaultInvoice: dto.isDefaultInvoice ?? false,
        },
      });
    });
  }

  // update()/remove() below are scoped through the controller's pre-check (findOne)
  // today, but neither applied tenantId to its own mutating query — same
  // defense-in-depth gap fixed across products/suppliers/customers services.
  update(tenantId: string, branchId: string, id: string, dto: UpsertPrinterDto): Promise<Printer> {
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefaultReceipt) {
        await tx.printer.updateMany({
          where: { tenantId, branchId, id: { not: id } },
          data: { isDefaultReceipt: false },
        });
      }
      if (dto.isDefaultInvoice) {
        await tx.printer.updateMany({
          where: { tenantId, branchId, id: { not: id } },
          data: { isDefaultInvoice: false },
        });
      }
      const { count } = await tx.printer.updateMany({
        where: { id, tenantId },
        data: {
          name: dto.name,
          type: dto.type,
          systemPrinterName: dto.systemPrinterName,
          isDefaultReceipt: dto.isDefaultReceipt ?? false,
          isDefaultInvoice: dto.isDefaultInvoice ?? false,
        },
      });
      if (count === 0) throw new NotFoundException(`Printer ${id} not found.`);
      return tx.printer.findUniqueOrThrow({ where: { id } });
    });
  }

  async remove(tenantId: string, id: string): Promise<Printer> {
    const printer = await this.prisma.printer.findFirst({ where: { id, tenantId } });
    if (!printer) throw new NotFoundException(`Printer ${id} not found.`);
    return this.prisma.printer.delete({ where: { id } });
  }
}
