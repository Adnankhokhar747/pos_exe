import { Injectable } from '@nestjs/common';
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
      return tx.printer.update({
        where: { id },
        data: {
          name: dto.name,
          type: dto.type,
          systemPrinterName: dto.systemPrinterName,
          isDefaultReceipt: dto.isDefaultReceipt ?? false,
          isDefaultInvoice: dto.isDefaultInvoice ?? false,
        },
      });
    });
  }

  remove(id: string): Promise<Printer> {
    return this.prisma.printer.delete({ where: { id } });
  }
}
