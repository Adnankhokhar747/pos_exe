import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { BundleComponent, Product } from '@prisma/client';
import { ProductsService, ProductWithStock } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { SetBundleComponentsDto } from './dto/set-bundle-components.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { LicenseGuard } from '../licensing/license.guard';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';

@Controller('api/v1/products')
@UseGuards(JwtAuthGuard, LicenseGuard, PermissionsGuard)
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

  @Get(':id')
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<Product> {
    const product = await this.productsService.findOne(user.tenantId, id);
    if (!product) throw new NotFoundException(`Product ${id} not found.`);
    return product;
  }

  @Patch(':id')
  @RequirePermission('product.write')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<Product> {
    const product = await this.productsService.findOne(user.tenantId, id);
    if (!product) throw new NotFoundException(`Product ${id} not found.`);
    return this.productsService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('product.write')
  async softDelete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<Product> {
    const product = await this.productsService.findOne(user.tenantId, id);
    if (!product) throw new NotFoundException(`Product ${id} not found.`);
    return this.productsService.softDelete(user.tenantId, id);
  }

  @Get(':id/variants')
  listVariants(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<Product[]> {
    return this.productsService.listVariants(user.tenantId, id);
  }

  @Get(':id/bundle-components')
  getBundleComponents(@Param('id') id: string): Promise<(BundleComponent & { componentProduct: Product })[]> {
    return this.productsService.getBundleComponents(id);
  }

  @Post(':id/bundle-components')
  @RequirePermission('product.write')
  setBundleComponents(@Param('id') id: string, @Body() dto: SetBundleComponentsDto): Promise<void> {
    return this.productsService.setBundleComponents(id, dto);
  }
}
