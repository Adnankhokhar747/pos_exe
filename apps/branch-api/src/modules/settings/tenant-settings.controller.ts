import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { Tenant } from '@prisma/client';
import { TenantSettingsService } from './tenant-settings.service';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { LicenseGuard } from '../licensing/license.guard';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';

@Controller('api/v1/settings/tenant')
@UseGuards(JwtAuthGuard, LicenseGuard, PermissionsGuard)
export class TenantSettingsController {
  constructor(private readonly tenantSettingsService: TenantSettingsService) {}

  @Get()
  get(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Pick<Tenant, 'id' | 'name' | 'baseCurrency' | 'address' | 'taxNumber' | 'logoPath' | 'defaultTaxTemplateId'>> {
    return this.tenantSettingsService.get(user.tenantId);
  }

  @Patch()
  @RequirePermission('settings.write')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTenantSettingsDto,
  ): Promise<Pick<Tenant, 'id' | 'name' | 'baseCurrency' | 'address' | 'taxNumber' | 'logoPath' | 'defaultTaxTemplateId'>> {
    return this.tenantSettingsService.update(user.tenantId, dto);
  }
}
