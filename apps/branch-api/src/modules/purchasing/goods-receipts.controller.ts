import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { GoodsReceipt } from '@prisma/client';
import { GoodsReceiptsService } from './goods-receipts.service';
import { CreateGoodsReceiptDto } from './dto/create-goods-receipt.dto';
import { VoidGoodsReceiptDto } from './dto/void.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { LicenseGuard } from '../licensing/license.guard';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';

@Controller('api/v1/goods-receipts')
@UseGuards(JwtAuthGuard, LicenseGuard, PermissionsGuard)
export class GoodsReceiptsController {
  constructor(private readonly goodsReceiptsService: GoodsReceiptsService) {}

  @Get()
  list(@Query('warehouseId') warehouseId?: string): Promise<GoodsReceipt[]> {
    return this.goodsReceiptsService.list(warehouseId);
  }

  @Post()
  @RequirePermission('purchase.create')
  receive(@Body() dto: CreateGoodsReceiptDto): Promise<GoodsReceipt> {
    return this.goodsReceiptsService.receive(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.goodsReceiptsService.findOne(id);
  }

  @Post(':id/void')
  @RequirePermission('purchase.approve')
  void(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: VoidGoodsReceiptDto,
  ): Promise<GoodsReceipt> {
    return this.goodsReceiptsService.void(id, user.userId, dto.reason);
  }
}
