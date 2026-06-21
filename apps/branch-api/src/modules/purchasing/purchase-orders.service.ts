import { Injectable } from '@nestjs/common';
import { Prisma, PurchaseOrder } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';

@Injectable()
export class PurchaseOrdersService {
  constructor(private readonly prisma: PrismaService) {}

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
