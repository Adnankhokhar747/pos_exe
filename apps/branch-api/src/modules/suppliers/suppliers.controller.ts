import { Body, Controller, Get, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Supplier, SupplierLedgerEntry } from '@prisma/client';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';

@Controller('api/v1/suppliers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('search') search?: string): Promise<Supplier[]> {
    return this.suppliersService.list(user.tenantId, search);
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
}
