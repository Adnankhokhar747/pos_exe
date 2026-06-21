import { Injectable } from '@nestjs/common';
import { GoodsReceipt, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGoodsReceiptDto } from './dto/create-goods-receipt.dto';

@Injectable()
export class GoodsReceiptsService {
  constructor(private readonly prisma: PrismaService) {}

  // Creates and posts a goods receipt in one step: increments stock (via the
  // append-only ledger, per docs/01-database-design.md §6), and — if linked to
  // a PO — advances that PO's received quantities/status.
  async receive(dto: CreateGoodsReceiptDto): Promise<GoodsReceipt> {
    const receiptNo = await this.nextReceiptNumber(dto.warehouseId);

    return this.prisma.$transaction(async (tx) => {
      const receipt = await tx.goodsReceipt.create({
        data: {
          purchaseOrderId: dto.purchaseOrderId,
          warehouseId: dto.warehouseId,
          receiptNo,
          status: 'posted',
          lines: {
            create: dto.lines.map((line) => ({
              productId: line.productId,
              quantityReceived: new Prisma.Decimal(line.quantityReceived),
              unitCost: new Prisma.Decimal(line.unitCost),
            })),
          },
        },
        include: { lines: true },
      });

      for (const line of dto.lines) {
        const quantity = new Prisma.Decimal(line.quantityReceived);
        const unitCost = new Prisma.Decimal(line.unitCost);

        await tx.stockLedgerEntry.create({
          data: {
            warehouseId: dto.warehouseId,
            productId: line.productId,
            movementType: 'purchase_receipt',
            quantityDelta: quantity,
            unitCostAtMove: unitCost,
            referenceTable: 'goods_receipts',
            referenceId: receipt.id,
          },
        });

        await tx.stockLevel.upsert({
          where: { warehouseId_productId: { warehouseId: dto.warehouseId, productId: line.productId } },
          update: { quantityOnHand: { increment: quantity } },
          create: { warehouseId: dto.warehouseId, productId: line.productId, quantityOnHand: quantity },
        });
      }

      if (dto.purchaseOrderId) {
        await this.advancePurchaseOrder(tx, dto.purchaseOrderId, dto.lines);
      }

      return receipt;
    });
  }

  private async advancePurchaseOrder(
    tx: Prisma.TransactionClient,
    purchaseOrderId: string,
    lines: CreateGoodsReceiptDto['lines'],
  ): Promise<void> {
    for (const line of lines) {
      await tx.purchaseOrderLine.updateMany({
        where: { purchaseOrderId, productId: line.productId },
        data: { quantityReceived: { increment: new Prisma.Decimal(line.quantityReceived) } },
      });
    }

    const orderLines = await tx.purchaseOrderLine.findMany({ where: { purchaseOrderId } });
    const fullyReceived = orderLines.every((orderLine) => orderLine.quantityReceived.gte(orderLine.quantityOrdered));
    await tx.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: { status: fullyReceived ? 'received' : 'partially_received' },
    });
  }

  list(warehouseId?: string) {
    return this.prisma.goodsReceipt.findMany({
      where: warehouseId ? { warehouseId } : undefined,
      include: { lines: true },
      orderBy: { receivedAt: 'desc' },
      take: 200,
    });
  }

  private async nextReceiptNumber(warehouseId: string): Promise<string> {
    const count = await this.prisma.goodsReceipt.count({ where: { warehouseId } });
    return `GR-${String(count + 1).padStart(6, '0')}`;
  }
}
