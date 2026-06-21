import { Injectable } from '@nestjs/common';
import { Prisma, StockTransfer } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStockTransferDto } from './dto/create-stock-transfer.dto';
import { InsufficientStockError } from '../../common/exceptions/domain-exception';

@Injectable()
export class StockTransfersService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateStockTransferDto): Promise<StockTransfer> {
    return this.prisma.stockTransfer.create({
      data: {
        fromWarehouseId: dto.fromWarehouseId,
        toWarehouseId: dto.toWarehouseId,
        status: 'draft',
        lines: {
          create: dto.lines.map((line) => ({
            productId: line.productId,
            quantity: new Prisma.Decimal(line.quantity),
          })),
        },
      },
      include: { lines: true },
    });
  }

  // Two-step transfer per docs/00-functional-specification.md §13.2: dispatch
  // decrements the source warehouse now; receive (below) increments the
  // destination later. Stock sits in neither location's on-hand total while
  // "dispatched" — an accepted in-transit gap, not a bug.
  async dispatch(id: string): Promise<StockTransfer> {
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUniqueOrThrow({ where: { id }, include: { lines: true } });

      for (const line of transfer.lines) {
        const stock = await tx.stockLevel.findUnique({
          where: { warehouseId_productId: { warehouseId: transfer.fromWarehouseId, productId: line.productId } },
        });
        if (!stock || stock.quantityOnHand.lessThan(line.quantity)) {
          throw new InsufficientStockError(line.productId, stock?.quantityOnHand.toString() ?? '0', line.quantity.toString());
        }

        await tx.stockLedgerEntry.create({
          data: {
            warehouseId: transfer.fromWarehouseId,
            productId: line.productId,
            movementType: 'transfer_out',
            quantityDelta: line.quantity.neg(),
            referenceTable: 'stock_transfers',
            referenceId: transfer.id,
          },
        });
        await tx.stockLevel.update({
          where: { warehouseId_productId: { warehouseId: transfer.fromWarehouseId, productId: line.productId } },
          data: { quantityOnHand: { decrement: line.quantity } },
        });
      }

      return tx.stockTransfer.update({ where: { id }, data: { status: 'dispatched' } });
    });
  }

  async receive(id: string): Promise<StockTransfer> {
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUniqueOrThrow({ where: { id }, include: { lines: true } });

      for (const line of transfer.lines) {
        await tx.stockLedgerEntry.create({
          data: {
            warehouseId: transfer.toWarehouseId,
            productId: line.productId,
            movementType: 'transfer_in',
            quantityDelta: line.quantity,
            referenceTable: 'stock_transfers',
            referenceId: transfer.id,
          },
        });
        await tx.stockLevel.upsert({
          where: { warehouseId_productId: { warehouseId: transfer.toWarehouseId, productId: line.productId } },
          update: { quantityOnHand: { increment: line.quantity } },
          create: { warehouseId: transfer.toWarehouseId, productId: line.productId, quantityOnHand: line.quantity },
        });
      }

      return tx.stockTransfer.update({ where: { id }, data: { status: 'received' } });
    });
  }

  list() {
    return this.prisma.stockTransfer.findMany({
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
