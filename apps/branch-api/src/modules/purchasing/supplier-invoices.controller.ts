import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { SupplierInvoice } from '@prisma/client';
import { SupplierInvoicesService } from './supplier-invoices.service';
import { CreateSupplierInvoiceDto } from './dto/create-supplier-invoice.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { RequirePermission } from '../../common/auth/require-permission.decorator';

@Controller('api/v1/supplier-invoices')
@UseGuards(JwtAuthGuard, PermissionsGuard)
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
}
