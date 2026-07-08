import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Category } from '@prisma/client';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { LicenseGuard } from '../licensing/license.guard';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryInUseError } from '../../common/exceptions/domain-exception';

@Controller('api/v1/categories')
@UseGuards(JwtAuthGuard, LicenseGuard, PermissionsGuard)
export class CategoriesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<Category> {
    const category = await this.prisma.category.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!category) throw new NotFoundException(`Category ${id} not found.`);
    return category;
  }

  @Post()
  @RequirePermission('product.write')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCategoryDto): Promise<Category> {
    return this.prisma.category.create({
      data: { tenantId: user.tenantId, name: dto.name, parentId: dto.parentId },
    });
  }

  @Patch(':id')
  @RequirePermission('product.write')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<Category> {
    const category = await this.prisma.category.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!category) throw new NotFoundException(`Category ${id} not found.`);
    return this.prisma.category.update({ where: { id }, data: { ...dto } });
  }

  @Delete(':id')
  @RequirePermission('product.write')
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<Category> {
    const category = await this.prisma.category.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!category) throw new NotFoundException(`Category ${id} not found.`);
    const productCount = await this.prisma.product.count({ where: { categoryId: id } });
    if (productCount > 0) throw new CategoryInUseError(productCount);
    return this.prisma.category.delete({ where: { id } });
  }
}
