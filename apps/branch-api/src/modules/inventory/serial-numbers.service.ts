import { Injectable } from '@nestjs/common';
import { SerialNumber, SerialNumberStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SerialNumbersService {
  constructor(private readonly prisma: PrismaService) {}

  list(warehouseId?: string, productId?: string, status?: SerialNumberStatus): Promise<SerialNumber[]> {
    return this.prisma.serialNumber.findMany({
      where: { warehouseId, productId, status },
      orderBy: { createdAt: 'asc' },
    });
  }

  findOne(id: string): Promise<SerialNumber | null> {
    return this.prisma.serialNumber.findUnique({ where: { id } });
  }
}
