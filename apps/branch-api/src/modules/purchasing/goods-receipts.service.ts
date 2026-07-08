import { Injectable, NotFoundException } from '@nestjs/common';
import { GoodsReceipt, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGoodsReceiptDto } from './dto/create-goods-receipt.dto';
import { GoodsReceiptNotVoidableError, RecordAlreadyVoidedError } from '../../common/exceptions/domain-exception';

@Injectable()
export class GoodsReceiptsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string) {
    const receipt = await this.prisma.goodsReceipt.findUnique({ where: { id }, include: { lines: true } });
    if (!receipt) throw new NotFoundException(`Goods receipt ${id} not found.`);
    return receipt;
  }

  // Fully reverses a posted receipt: undoes the stock/batch/serial effects from
  // receive() above and rolls back the linked PO's received quantities. Blocked
  // whenever the reversal can't be applied cleanly (stock already consumed
  // elsewhere, serials already sold, or a supplier invoice already booked
  // against it) rather than leaving stock or ledgers in an inconsistent state.
  async void(id: string, voidedBy: string, reason: string): Promise<GoodsReceipt> {
    const receipt = await this.findOne(id);
    if (receipt.status === 'voided') throw new RecordAlreadyVoidedError('goods receipt');

    const linkedInvoice = await this.prisma.supplierInvoice.findFirst({
      where: { goodsReceiptId: id, voidedAt: null },
    });
    if (linkedInvoice) {
      throw new GoodsReceiptNotVoidableError(
        'a supplier invoice has already been recorded against it — void that invoice first',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      for (const line of receipt.lines) {
        const stock = await tx.stockLevel.findUnique({
          where: { warehouseId_productId: { warehouseId: receipt.warehouseId, productId: line.productId } },
        });
        if (!stock || stock.quantityOnHand.lessThan(line.quantityReceived)) {
          throw new GoodsReceiptNotVoidableError(
            `some of the stock received for product ${line.productId} has already been used elsewhere`,
          );
        }

        if (line.batchNo) {
          const batch = await tx.batch.findUnique({
            where: {
              productId_warehouseId_batchNo: { productId: line.productId, warehouseId: receipt.warehouseId, batchNo: line.batchNo },
            },
          });
          if (!batch || batch.quantityOnHand.lessThan(line.quantityReceived)) {
            throw new GoodsReceiptNotVoidableError(`batch ${line.batchNo} no longer has enough quantity to reverse`);
          }
        }

        const serialNumbers = (line.serialNumbers as string[] | null) ?? [];
        if (serialNumbers.length > 0) {
          const serials = await tx.serialNumber.findMany({
            where: { productId: line.productId, warehouseId: receipt.warehouseId, serialNo: { in: serialNumbers } },
          });
          const notInStock = serials.filter((s) => s.status !== 'in_stock');
          if (notInStock.length > 0) {
            throw new GoodsReceiptNotVoidableError(
              `serial number(s) ${notInStock.map((s) => s.serialNo).join(', ')} have already been sold or moved`,
            );
          }
        }
      }

      for (const line of receipt.lines) {
        await tx.stockLedgerEntry.create({
          data: {
            warehouseId: receipt.warehouseId,
            productId: line.productId,
            movementType: 'purchase_return',
            quantityDelta: line.quantityReceived.neg(),
            unitCostAtMove: line.unitCost,
            referenceTable: 'goods_receipts',
            referenceId: receipt.id,
          },
        });
        await tx.stockLevel.update({
          where: { warehouseId_productId: { warehouseId: receipt.warehouseId, productId: line.productId } },
          data: { quantityOnHand: { decrement: line.quantityReceived } },
        });

        if (line.batchNo) {
          await tx.batch.update({
            where: {
              productId_warehouseId_batchNo: { productId: line.productId, warehouseId: receipt.warehouseId, batchNo: line.batchNo },
            },
            data: { quantityOnHand: { decrement: line.quantityReceived } },
          });
        }

        const serialNumbers = (line.serialNumbers as string[] | null) ?? [];
        if (serialNumbers.length > 0) {
          await tx.serialNumber.deleteMany({
            where: { productId: line.productId, warehouseId: receipt.warehouseId, serialNo: { in: serialNumbers } },
          });
        }
      }

      if (receipt.purchaseOrderId) {
        for (const line of receipt.lines) {
          await tx.purchaseOrderLine.updateMany({
            where: { purchaseOrderId: receipt.purchaseOrderId, productId: line.productId },
            data: { quantityReceived: { decrement: line.quantityReceived } },
          });
        }
        const orderLines = await tx.purchaseOrderLine.findMany({ where: { purchaseOrderId: receipt.purchaseOrderId } });
        const anyReceived = orderLines.some((l) => l.quantityReceived.greaterThan(0));
        const fullyReceived = orderLines.every((l) => l.quantityReceived.gte(l.quantityOrdered));
        await tx.purchaseOrder.update({
          where: { id: receipt.purchaseOrderId },
          data: { status: fullyReceived ? 'received' : anyReceived ? 'partially_received' : 'sent' },
        });
      }

      return tx.goodsReceipt.update({
        where: { id },
        data: { status: 'voided', voidedAt: new Date(), voidedBy, voidReason: reason },
        include: { lines: true },
      });
    });
  }

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
              batchNo: line.batchNo,
              expiryDate: line.expiryDate ? new Date(line.expiryDate) : undefined,
              serialNumbers: line.serialNumbers,
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

        if (line.batchNo) {
          await tx.batch.upsert({
            where: { productId_warehouseId_batchNo: { productId: line.productId, warehouseId: dto.warehouseId, batchNo: line.batchNo } },
            update: { quantityOnHand: { increment: quantity }, costPrice: unitCost },
            create: {
              productId: line.productId,
              warehouseId: dto.warehouseId,
              batchNo: line.batchNo,
              expiryDate: line.expiryDate ? new Date(line.expiryDate) : undefined,
              quantityOnHand: quantity,
              costPrice: unitCost,
            },
          });
        }

        if (line.serialNumbers?.length) {
          await tx.serialNumber.createMany({
            data: line.serialNumbers.map((serialNo) => ({
              productId: line.productId,
              warehouseId: dto.warehouseId,
              serialNo,
              status: 'in_stock' as const,
            })),
          });
        }
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
