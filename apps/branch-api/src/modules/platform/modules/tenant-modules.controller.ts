import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { TenantModulesService, TenantModuleGrant } from './tenant-modules.service';
import { UpsertTenantModuleDto } from './dto/upsert-tenant-module.dto';
import { PlatformAuthGuard } from '../auth/platform-auth.guard';

@Controller('api/v1/platform/companies/:companyId/modules')
@UseGuards(PlatformAuthGuard)
export class TenantModulesController {
  constructor(private readonly tenantModulesService: TenantModulesService) {}

  @Get()
  listForCompany(@Param('companyId') companyId: string): Promise<TenantModuleGrant[]> {
    return this.tenantModulesService.listForCompany(companyId);
  }

  @Patch(':moduleCode')
  upsert(
    @Param('companyId') companyId: string,
    @Param('moduleCode') moduleCode: string,
    @Body() dto: UpsertTenantModuleDto,
  ): Promise<TenantModuleGrant> {
    return this.tenantModulesService.upsert(companyId, moduleCode, dto);
  }
}
