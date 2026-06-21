import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { StockAdjustment } from '@prisma/client';
import { StockAdjustmentsService } from './stock-adjustments.service';
import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { RequirePermission } from '../../common/auth/require-permission.decorator';

@Controller('api/v1/stock-adjustments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StockAdjustmentsController {
  constructor(private readonly stockAdjustmentsService: StockAdjustmentsService) {}

  @Get()
  list(@Query('warehouseId') warehouseId?: string): Promise<StockAdjustment[]> {
    return this.stockAdjustmentsService.list(warehouseId);
  }

  @Post()
  @RequirePermission('stock.adjust')
  create(@Body() dto: CreateStockAdjustmentDto): Promise<StockAdjustment> {
    return this.stockAdjustmentsService.create(dto);
  }
}
