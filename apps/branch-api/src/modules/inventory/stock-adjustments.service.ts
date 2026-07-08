import { Injectable } from '@nestjs/common';
import { Prisma, StockAdjustment } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto';

@Injectable()
export class StockAdjustmentsService {
  constructor(private readonly prisma: PrismaService) {}

  // Posts immediately (no separate draft step, unlike Purchasing's PO/GR split)
  // since count-and-post is the realistic cadence for a stock count, per
  // docs/00-functional-specification.md §13.2.
  async create(dto: CreateStockAdjustmentDto): Promise<StockAdjustment> {
    return this.prisma.$transaction(async (tx) => {
      const currentLevels = await tx.stockLevel.findMany({
        where: { warehouseId: dto.warehouseId, productId: { in: dto.lines.map((line) => line.productId) } },
      });
      const systemQtyByProduct = new Map(currentLevels.map((level) => [level.productId, level.quantityOnHand]));

      const adjustment = await tx.stockAdjustment.create({
        data: {
          warehouseId: dto.warehouseId,
          reasonCode: dto.reasonCode,
          note: dto.note,
          status: 'posted',
          lines: {
            create: dto.lines.map((line) => ({
              productId: line.productId,
              countedQuantity: new Prisma.Decimal(line.countedQuantity),
              systemQuantity: systemQtyByProduct.get(line.productId) ?? new Prisma.Decimal(0),
            })),
          },
        },
        include: { lines: true },
      });

      for (const line of dto.lines) {
        const counted = new Prisma.Decimal(line.countedQuantity);
        const system = systemQtyByProduct.get(line.productId) ?? new Prisma.Decimal(0);
        const delta = counted.sub(system);
        if (delta.isZero()) continue;

        await tx.stockLedgerEntry.create({
          data: {
            warehouseId: dto.warehouseId,
            productId: line.productId,
            movementType: 'adjustment',
            quantityDelta: delta,
            referenceTable: 'stock_adjustments',
            referenceId: adjustment.id,
          },
        });

        await tx.stockLevel.upsert({
          where: { warehouseId_productId: { warehouseId: dto.warehouseId, productId: line.productId } },
          update: { quantityOnHand: counted },
          create: { warehouseId: dto.warehouseId, productId: line.productId, quantityOnHand: counted },
        });
      }

      return adjustment;
    });
  }

  list(warehouseId?: string) {
    return this.prisma.stockAdjustment.findMany({
      where: warehouseId ? { warehouseId } : undefined,
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  findOne(id: string) {
    return this.prisma.stockAdjustment.findUnique({ where: { id }, include: { lines: true } });
  }
}
