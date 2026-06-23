import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PurchaseOrder } from '@prisma/client';
import { PurchaseOrdersService } from './purchase-orders.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { LicenseGuard } from '../licensing/license.guard';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';

@Controller('api/v1/purchase-orders')
@UseGuards(JwtAuthGuard, LicenseGuard, PermissionsGuard)
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.purchaseOrdersService.list(user.tenantId);
  }

  @Post()
  @RequirePermission('purchase.create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePurchaseOrderDto): Promise<PurchaseOrder> {
    return this.purchaseOrdersService.create(user.tenantId, dto);
  }

  @Post(':id/send')
  @RequirePermission('purchase.approve')
  send(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<PurchaseOrder> {
    return this.purchaseOrdersService.send(user.tenantId, id);
  }
}
