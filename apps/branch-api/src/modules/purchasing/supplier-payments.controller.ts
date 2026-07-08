import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SupplierPayment } from '@prisma/client';
import { SupplierPaymentsService } from './supplier-payments.service';
import { CreateSupplierPaymentDto } from './dto/create-supplier-payment.dto';
import { UpdateSupplierPaymentDto } from './dto/update-supplier-payment.dto';
import { VoidSupplierPaymentDto } from './dto/void.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { LicenseGuard } from '../licensing/license.guard';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';

@Controller('api/v1/supplier-payments')
@UseGuards(JwtAuthGuard, LicenseGuard, PermissionsGuard)
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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.supplierPaymentsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermission('purchase.create')
  update(@Param('id') id: string, @Body() dto: UpdateSupplierPaymentDto): Promise<SupplierPayment> {
    return this.supplierPaymentsService.update(id, dto);
  }

  @Post(':id/void')
  @RequirePermission('purchase.approve')
  void(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: VoidSupplierPaymentDto,
  ): Promise<SupplierPayment> {
    return this.supplierPaymentsService.void(id, user.userId, dto.reason);
  }
}
