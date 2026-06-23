import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SerialNumber, SerialNumberStatus } from '@prisma/client';
import { SerialNumbersService } from './serial-numbers.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { LicenseGuard } from '../licensing/license.guard';

@Controller('api/v1/serial-numbers')
@UseGuards(JwtAuthGuard, LicenseGuard, PermissionsGuard)
export class SerialNumbersController {
  constructor(private readonly serialNumbersService: SerialNumbersService) {}

  @Get()
  list(
    @Query('warehouseId') warehouseId?: string,
    @Query('productId') productId?: string,
    @Query('status') status?: SerialNumberStatus,
  ): Promise<SerialNumber[]> {
    return this.serialNumbersService.list(warehouseId, productId, status);
  }
}
