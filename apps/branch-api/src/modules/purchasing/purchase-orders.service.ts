import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PurchaseOrder } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import {
  PurchaseOrderNotCancellableError,
  PurchaseOrderNotEditableError,
  RecordAlreadyVoidedError,
} from '../../common/exceptions/domain-exception';

@Injectable()
export class PurchaseOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(tenantId: string, id: string) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
      include: { lines: true, supplier: true },
    });
    if (!order) throw new NotFoundException(`Purchase order ${id} not found.`);
    return order;
  }

  async update(tenantId: string, id: string, dto: UpdatePurchaseOrderDto): Promise<PurchaseOrder> {
    const order = await this.findOne(tenantId, id);
    if (order.status !== 'draft') throw new PurchaseOrderNotEditableError(order.status);

    return this.prisma.$transaction(async (tx) => {
      if (dto.lines) {
        await tx.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: id } });
      }
      return tx.purchaseOrder.update({
        where: { id },
        data: {
          ...(dto.supplierId !== undefined ? { supplierId: dto.supplierId } : {}),
          ...(dto.warehouseId !== undefined ? { warehouseId: dto.warehouseId } : {}),
          ...(dto.lines
            ? {
                lines: {
                  create: dto.lines.map((line) => ({
                    productId: line.productId,
                    quantityOrdered: new Prisma.Decimal(line.quantityOrdered),
                    unitCost: new Prisma.Decimal(line.unitCost),
                  })),
                },
              }
            : {}),
        },
        include: { lines: true, supplier: true },
      });
    });
  }

  async void(tenantId: string, id: string, voidedBy: string, reason: string): Promise<PurchaseOrder> {
    const order = await this.findOne(tenantId, id);
    if (order.status === 'cancelled') throw new RecordAlreadyVoidedError('purchase order');
    if (order.status === 'received') throw new PurchaseOrderNotCancellableError(order.status);

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'cancelled', voidedAt: new Date(), voidedBy, voidReason: reason },
    });
  }

  async create(tenantId: string, dto: CreatePurchaseOrderDto): Promise<PurchaseOrder> {
    const orderNo = await this.nextOrderNumber(tenantId);

    return this.prisma.purchaseOrder.create({
      data: {
        tenantId,
        supplierId: dto.supplierId,
        warehouseId: dto.warehouseId,
        orderNo,
        status: 'draft',
        lines: {
          create: dto.lines.map((line) => ({
            productId: line.productId,
            quantityOrdered: new Prisma.Decimal(line.quantityOrdered),
            unitCost: new Prisma.Decimal(line.unitCost),
          })),
        },
      },
      include: { lines: true },
    });
  }

  async send(tenantId: string, id: string): Promise<PurchaseOrder> {
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'sent' },
    });
  }

  list(tenantId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { tenantId },
      include: { lines: true, supplier: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  private async nextOrderNumber(tenantId: string): Promise<string> {
    const count = await this.prisma.purchaseOrder.count({ where: { tenantId } });
    return `PO-${String(count + 1).padStart(6, '0')}`;
  }
}
