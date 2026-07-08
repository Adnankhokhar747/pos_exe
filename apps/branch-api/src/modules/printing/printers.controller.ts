import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Printer } from '@prisma/client';
import { PrintersService } from './printers.service';
import { UpsertPrinterDto } from './dto/upsert-printer.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { LicenseGuard } from '../licensing/license.guard';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';

@Controller('api/v1/settings/printers')
@UseGuards(JwtAuthGuard, LicenseGuard, PermissionsGuard)
export class PrintersController {
  constructor(private readonly printersService: PrintersService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId: string): Promise<Printer[]> {
    return this.printersService.list(user.tenantId, branchId);
  }

  @Post()
  @RequirePermission('settings.write')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId: string,
    @Body() dto: UpsertPrinterDto,
  ): Promise<Printer> {
    return this.printersService.create(user.tenantId, branchId, dto);
  }

  @Patch(':id')
  @RequirePermission('settings.write')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('branchId') branchId: string,
    @Body() dto: UpsertPrinterDto,
  ): Promise<Printer> {
    const printer = await this.printersService.findOne(user.tenantId, id);
    if (!printer) throw new NotFoundException(`Printer ${id} not found.`);
    return this.printersService.update(user.tenantId, branchId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('settings.write')
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<Printer> {
    const printer = await this.printersService.findOne(user.tenantId, id);
    if (!printer) throw new NotFoundException(`Printer ${id} not found.`);
    return this.printersService.remove(user.tenantId, id);
  }
}
