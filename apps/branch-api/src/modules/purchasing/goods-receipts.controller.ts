import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { GoodsReceipt } from '@prisma/client';
import { GoodsReceiptsService } from './goods-receipts.service';
import { CreateGoodsReceiptDto } from './dto/create-goods-receipt.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { LicenseGuard } from '../licensing/license.guard';
import { RequirePermission } from '../../common/auth/require-permission.decorator';

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
}
