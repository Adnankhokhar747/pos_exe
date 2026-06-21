import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { SupplierPayment } from '@prisma/client';
import { SupplierPaymentsService } from './supplier-payments.service';
import { CreateSupplierPaymentDto } from './dto/create-supplier-payment.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { RequirePermission } from '../../common/auth/require-permission.decorator';

@Controller('api/v1/supplier-payments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SupplierPaymentsController {
  constructor(private readonly supplierPaymentsService: SupplierPaymentsService) {}

  @Get()
  list(@Query('supplierId') supplierId?: string): Promise<SupplierPayment[]> {
    return this.supplierPaymentsService.list(supplierId);
  }

  @Post()
  @RequirePermission('purchase.create')
  create(@Body() dto: CreateSupplierPaymentDto): Promise<SupplierPayment> {
    return this.supplierPaymentsService.create(dto);
  }
}
