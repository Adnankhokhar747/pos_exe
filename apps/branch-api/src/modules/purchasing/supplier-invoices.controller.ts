import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SupplierInvoice } from '@prisma/client';
import { SupplierInvoicesService } from './supplier-invoices.service';
import { CreateSupplierInvoiceDto } from './dto/create-supplier-invoice.dto';
import { UpdateSupplierInvoiceDto } from './dto/update-supplier-invoice.dto';
import { VoidSupplierInvoiceDto } from './dto/void.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { LicenseGuard } from '../licensing/license.guard';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';

@Controller('api/v1/supplier-invoices')
@UseGuards(JwtAuthGuard, LicenseGuard, PermissionsGuard)
export class SupplierInvoicesController {
  constructor(private readonly supplierInvoicesService: SupplierInvoicesService) {}

  @Get()
  list(@Query('supplierId') supplierId?: string): Promise<SupplierInvoice[]> {
    return this.supplierInvoicesService.list(supplierId);
  }

  @Post()
  @RequirePermission('purchase.create')
  create(@Body() dto: CreateSupplierInvoiceDto): Promise<SupplierInvoice> {
    return this.supplierInvoicesService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.supplierInvoicesService.findOne(id);
  }

  @Patch(':id')
  @RequirePermission('purchase.create')
  update(@Param('id') id: string, @Body() dto: UpdateSupplierInvoiceDto): Promise<SupplierInvoice> {
    return this.supplierInvoicesService.update(id, dto);
  }

  @Post(':id/void')
  @RequirePermission('purchase.approve')
  void(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: VoidSupplierInvoiceDto,
  ): Promise<SupplierInvoice> {
    return this.supplierInvoicesService.void(id, user.userId, dto.reason);
  }
}
