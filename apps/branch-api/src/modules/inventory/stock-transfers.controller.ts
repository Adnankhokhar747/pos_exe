import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { StockTransfer } from '@prisma/client';
import { StockTransfersService } from './stock-transfers.service';
import { CreateStockTransferDto } from './dto/create-stock-transfer.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { LicenseGuard } from '../licensing/license.guard';
import { RequirePermission } from '../../common/auth/require-permission.decorator';

@Controller('api/v1/stock-transfers')
@UseGuards(JwtAuthGuard, LicenseGuard, PermissionsGuard)
export class StockTransfersController {
  constructor(private readonly stockTransfersService: StockTransfersService) {}

  @Get()
  list(): Promise<StockTransfer[]> {
    return this.stockTransfersService.list();
  }

  @Post()
  @RequirePermission('stock.transfer')
  create(@Body() dto: CreateStockTransferDto): Promise<StockTransfer> {
    return this.stockTransfersService.create(dto);
  }

  @Post(':id/dispatch')
  @RequirePermission('stock.transfer')
  dispatch(@Param('id') id: string): Promise<StockTransfer> {
    return this.stockTransfersService.dispatch(id);
  }

  @Post(':id/receive')
  @RequirePermission('stock.transfer')
  receive(@Param('id') id: string): Promise<StockTransfer> {
    return this.stockTransfersService.receive(id);
  }
}
