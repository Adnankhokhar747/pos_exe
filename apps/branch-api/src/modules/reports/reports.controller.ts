import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { RequirePermission } from '../../common/auth/require-permission.decorator';

@Controller('api/v1/reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('report.financial.view')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales-summary')
  salesSummary(@Query('branchId') branchId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.reportsService.salesSummary(branchId, new Date(from), new Date(to));
  }

  @Get('top-products')
  topProducts(@Query('branchId') branchId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.reportsService.topProducts(branchId, new Date(from), new Date(to));
  }

  @Get('inventory-valuation')
  inventoryValuation(@Query('warehouseId') warehouseId: string) {
    return this.reportsService.inventoryValuation(warehouseId);
  }

  @Get('low-stock')
  lowStock(@Query('warehouseId') warehouseId: string) {
    return this.reportsService.lowStock(warehouseId);
  }
}
