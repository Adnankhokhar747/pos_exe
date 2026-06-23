import { Injectable } from '@nestjs/common';
import { BundleComponent, Prisma, Product } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { SetBundleComponentsDto } from './dto/set-bundle-components.dto';

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
        taxTemplateId: dto.taxTemplateId,
        parentProductId: dto.parentProductId,
        variantAttributes: dto.variantAttributes,
        isBundle: dto.isBundle ?? false,
        trackBatches: dto.trackBatches ?? false,
        trackSerials: dto.trackSerials ?? false,
      },
    });
  }

  findByBarcode(tenantId: string, barcode: string): Promise<Product | null> {
    return this.prisma.product.findFirst({ where: { tenantId, barcode, deletedAt: null } });
  }

  findOne(tenantId: string, id: string): Promise<Product | null> {
    return this.prisma.product.findFirst({ where: { id, tenantId, deletedAt: null } });
  }

  update(tenantId: string, id: string, dto: UpdateProductDto): Promise<Product> {
    return this.prisma.product.update({
      where: { id },
      data: {
        sku: dto.sku,
        barcode: dto.barcode,
        name: dto.name,
        description: dto.description,
        categoryId: dto.categoryId,
        costPrice: dto.costPrice ? new Prisma.Decimal(dto.costPrice) : undefined,
        salePrice: dto.salePrice ? new Prisma.Decimal(dto.salePrice) : undefined,
        taxRatePct: dto.taxRatePct ? new Prisma.Decimal(dto.taxRatePct) : undefined,
        taxTemplateId: dto.taxTemplateId,
        trackBatches: dto.trackBatches,
        trackSerials: dto.trackSerials,
      },
    });
  }

  softDelete(tenantId: string, id: string): Promise<Product> {
    return this.prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  listVariants(tenantId: string, parentProductId: string): Promise<Product[]> {
    return this.prisma.product.findMany({
      where: { tenantId, parentProductId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  getBundleComponents(bundleProductId: string): Promise<(BundleComponent & { componentProduct: Product })[]> {
    return this.prisma.bundleComponent.findMany({
      where: { bundleProductId },
      include: { componentProduct: true },
    });
  }

  async setBundleComponents(bundleProductId: string, dto: SetBundleComponentsDto): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.bundleComponent.deleteMany({ where: { bundleProductId } });
      await tx.bundleComponent.createMany({
        data: dto.components.map((c) => ({
          bundleProductId,
          componentProductId: c.componentProductId,
          quantity: new Prisma.Decimal(c.quantity),
        })),
      });
      await tx.product.update({ where: { id: bundleProductId }, data: { isBundle: true } });
    });
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
      quantityOnHand: product.isBundle ? '∞' : stockByProduct.get(product.id) ?? '0',
    }));
  }
}
