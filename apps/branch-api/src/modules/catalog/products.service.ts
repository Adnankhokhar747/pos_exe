import { Injectable } from '@nestjs/common';
import { Prisma, Product } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';

export interface ProductWithStock extends Product {
  quantityOnHand: string;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  create(tenantId: string, dto: CreateProductDto): Promise<Product> {
    return this.prisma.product.create({
      data: {
        tenantId,
        sku: dto.sku,
        barcode: dto.barcode,
        name: dto.name,
        description: dto.description,
        categoryId: dto.categoryId,
        costPrice: new Prisma.Decimal(dto.costPrice),
        salePrice: new Prisma.Decimal(dto.salePrice),
        taxRatePct: dto.taxRatePct ? new Prisma.Decimal(dto.taxRatePct) : undefined,
      },
    });
  }

  findByBarcode(tenantId: string, barcode: string): Promise<Product | null> {
    return this.prisma.product.findFirst({ where: { tenantId, barcode, deletedAt: null } });
  }

  // Combined catalog + stock read for the POS product grid (docs/00-functional-specification.md §8).
  // A dedicated cross-context read, kept here rather than fragmented into the Inventory module,
  // since splitting it now (before there's a second consumer) would be premature for this phase.
  async listForPos(tenantId: string, warehouseId: string, search?: string): Promise<ProductWithStock[]> {
    const products = await this.prisma.product.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
                { barcode: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
      take: 200,
    });

    const stockLevels = await this.prisma.stockLevel.findMany({
      where: { warehouseId, productId: { in: products.map((p) => p.id) } },
    });
    const stockByProduct = new Map(stockLevels.map((s) => [s.productId, s.quantityOnHand.toString()]));

    return products.map((product) => ({
      ...product,
      quantityOnHand: stockByProduct.get(product.id) ?? '0',
    }));
  }
}
