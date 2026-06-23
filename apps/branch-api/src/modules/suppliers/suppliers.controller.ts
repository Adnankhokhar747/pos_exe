import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Supplier, SupplierLedgerEntry } from '@prisma/client';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { LicenseGuard } from '../licensing/license.guard';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';

@Controller('api/v1/suppliers')
@UseGuards(JwtAuthGuard, LicenseGuard, PermissionsGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('search') search?: string,
    @Query('includeInactive') includeInactive?: string,
  ): Promise<Supplier[]> {
    return this.suppliersService.list(user.tenantId, search, includeInactive === 'true');
  }

  @Post()
  @RequirePermission('supplier.write')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSupplierDto): Promise<Supplier> {
    return this.suppliersService.create(user.tenantId, dto);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<Supplier> {
    const supplier = await this.suppliersService.findOne(user.tenantId, id);
    if (!supplier) throw new NotFoundException(`Supplier ${id} not found.`);
    return supplier;
  }

  @Get(':id/ledger')
  getLedger(@Param('id') id: string): Promise<SupplierLedgerEntry[]> {
    return this.suppliersService.getLedger(id);
  }

  @Patch(':id')
  @RequirePermission('supplier.write')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ): Promise<Supplier> {
    const supplier = await this.suppliersService.findOne(user.tenantId, id);
    if (!supplier) throw new NotFoundException(`Supplier ${id} not found.`);
    return this.suppliersService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('supplier.write')
  async deactivate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<Supplier> {
    const supplier = await this.suppliersService.findOne(user.tenantId, id);
    if (!supplier) throw new NotFoundException(`Supplier ${id} not found.`);
    return this.suppliersService.deactivate(user.tenantId, id);
  }
}
