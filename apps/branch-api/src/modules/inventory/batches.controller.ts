import { Controller, Get, NotFoundException, Param, Query, UseGuards } from '@nestjs/common';
import { BatchesService } from './batches.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { LicenseGuard } from '../licensing/license.guard';

@Controller('api/v1/batches')
@UseGuards(JwtAuthGuard, LicenseGuard, PermissionsGuard)
export class BatchesController {
  constructor(private readonly batchesService: BatchesService) {}

  @Get()
  list(@Query('warehouseId') warehouseId?: string, @Query('productId') productId?: string) {
    return this.batchesService.list(warehouseId, productId);
  }

  @Get('expiring')
  expiring(@Query('warehouseId') warehouseId: string, @Query('withinDays') withinDays?: string) {
    return this.batchesService.expiring(warehouseId, withinDays ? Number(withinDays) : 30);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const batch = await this.batchesService.findOne(id);
    if (!batch) throw new NotFoundException(`Batch ${id} not found.`);
    return batch;
  }
}
