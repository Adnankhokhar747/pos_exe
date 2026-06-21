import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Category } from '@prisma/client';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';

@Controller('api/v1/categories')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CategoriesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  @Post()
  @RequirePermission('product.write')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCategoryDto): Promise<Category> {
    return this.prisma.category.create({
      data: { tenantId: user.tenantId, name: dto.name, parentId: dto.parentId },
    });
  }
}
