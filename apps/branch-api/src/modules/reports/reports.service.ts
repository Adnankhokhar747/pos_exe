import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const ZERO = new Prisma.Decimal(0);

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async salesSummary(branchId: string, from: Date, to: Date) {
    const invoices = await this.prisma.invoice.findMany({
      where: { branchId, status: 'completed', createdAt: { gte: from, lte: to } },
      select: { invoiceType: true, subtotal: true, discountTotal: true, taxTotal: true, grandTotal: true },
    });

    const sales = invoices.filter((invoice) => invoice.invoiceType === 'sale');
    const returns = invoices.filter((invoice) => invoice.invoiceType === 'return');

    const sum = (list: typeof invoices, field: 'subtotal' | 'discountTotal' | 'taxTotal' | 'grandTotal') =>
      list.reduce((total, invoice) => total.add(invoice[field]), ZERO);

    return {
      invoiceCount: sales.length,
      returnCount: returns.length,
      grossSales: sum(sales, 'subtotal').toString(),
      discounts: sum(sales, 'discountTotal').toString(),
      taxCollected: sum(sales, 'taxTotal').toString(),
      netSales: sum(sales, 'grandTotal').sub(sum(returns, 'grandTotal')).toString(),
    };
  }

  async topProducts(branchId: string, from: Date, to: Date, limit = 10) {
    const lines = await this.prisma.invoiceLine.findMany({
      where: {
        invoice: { branchId, status: 'completed', invoiceType: 'sale', createdAt: { gte: from, lte: to } },
      },
      include: { product: true },
    });

    const byProduct = new Map<string, { name: string; quantity: Prisma.Decimal; revenue: Prisma.Decimal }>();
    for (const line of lines) {
      const existing = byProduct.get(line.productId) ?? { name: line.product.name, quantity: ZERO, revenue: ZERO };
      existing.quantity = existing.quantity.add(line.quantity);
      existing.revenue = existing.revenue.add(line.lineTotal);
      byProduct.set(line.productId, existing);
    }

    return Array.from(byProduct.entries())
      .map(([productId, data]) => ({
        productId,
        name: data.name,
        quantity: data.quantity.toString(),
        revenue: data.revenue.toString(),
      }))
      .sort((a, b) => Number(b.quantity) - Number(a.quantity))
      .slice(0, limit);
  }

  async inventoryValuation(warehouseId: string) {
    const stockLevels = await this.prisma.stockLevel.findMany({
      where: { warehouseId },
      include: { product: true },
    });

    const lines = stockLevels
      .filter((level) => level.quantityOnHand.greaterThan(0))
      .map((level) => ({
        productId: level.productId,
        name: level.product.name,
        quantityOnHand: level.quantityOnHand.toString(),
        unitCost: level.product.costPrice.toString(),
        totalValue: level.quantityOnHand.mul(level.product.costPrice).toString(),
      }));

    const totalValue = lines.reduce((sum, line) => sum.add(new Prisma.Decimal(line.totalValue)), ZERO);

    return { lines, totalValue: totalValue.toString() };
  }

  async lowStock(warehouseId: string) {
    const stockLevels = await this.prisma.stockLevel.findMany({
      where: { warehouseId },
      include: { product: true },
    });

    return stockLevels
      .filter((level) => level.quantityOnHand.lessThanOrEqualTo(level.product.reorderLevel))
      .map((level) => ({
        productId: level.productId,
        name: level.product.name,
        quantityOnHand: level.quantityOnHand.toString(),
        reorderLevel: level.product.reorderLevel.toString(),
      }));
  }
}
