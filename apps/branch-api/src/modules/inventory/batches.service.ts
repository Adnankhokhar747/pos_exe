import { Injectable } from '@nestjs/common';
import { Batch } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BatchesService {
  constructor(private readonly prisma: PrismaService) {}

  findOne(id: string): Promise<(Batch & { product: { name: string } }) | null> {
    return this.prisma.batch.findUnique({
      where: { id },
      include: { product: { select: { name: true } } },
    });
  }

  list(warehouseId?: string, productId?: string): Promise<(Batch & { product: { name: string } })[]> {
    return this.prisma.batch.findMany({
      where: { warehouseId, productId },
      include: { product: { select: { name: true } } },
      orderBy: { expiryDate: 'asc' },
    });
  }

  expiring(warehouseId: string, withinDays: number): Promise<(Batch & { product: { name: string } })[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + withinDays);
    return this.prisma.batch.findMany({
      where: { warehouseId, expiryDate: { lte: cutoff }, quantityOnHand: { gt: 0 } },
      include: { product: { select: { name: true } } },
      orderBy: { expiryDate: 'asc' },
    });
  }
}
