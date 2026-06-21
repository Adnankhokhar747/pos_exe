import { Body, Controller, Get, NotFoundException, Post, Query, UseGuards } from '@nestjs/common';
import { Product } from '@prisma/client';
import { ProductsService, ProductWithStock } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';

@Controller('api/v1/products')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @RequirePermission('product.write')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProductDto): Promise<Product> {
    return this.productsService.create(user.tenantId, dto);
  }

  @Get('by-barcode')
  async findByBarcode(
    @CurrentUser() user: AuthenticatedUser,
    @Query('barcode') barcode: string,
  ): Promise<Product> {
    const product = await this.productsService.findByBarcode(user.tenantId, barcode);
    if (!product) {
      throw new NotFoundException(`No product found for barcode ${barcode}.`);
    }
    return product;
  }

  @Get('pos-grid')
  listForPos(
    @CurrentUser() user: AuthenticatedUser,
    @Query('warehouseId') warehouseId: string,
    @Query('search') search?: string,
  ): Promise<ProductWithStock[]> {
    return this.productsService.listForPos(user.tenantId, warehouseId, search);
  }
}
