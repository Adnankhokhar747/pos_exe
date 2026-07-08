import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { TaxTemplate } from '@prisma/client';
import { TaxTemplatesService } from './tax-templates.service';
import { UpsertTaxTemplateDto } from './dto/upsert-tax-template.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { LicenseGuard } from '../licensing/license.guard';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';

@Controller('api/v1/tax-templates')
@UseGuards(JwtAuthGuard, LicenseGuard, PermissionsGuard)
export class TaxTemplatesController {
  constructor(private readonly taxTemplatesService: TaxTemplatesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<TaxTemplate[]> {
    return this.taxTemplatesService.list(user.tenantId);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<TaxTemplate> {
    const taxTemplate = await this.taxTemplatesService.findOne(user.tenantId, id);
    if (!taxTemplate) throw new NotFoundException(`Tax template ${id} not found.`);
    return taxTemplate;
  }

  @Post()
  @RequirePermission('settings.write')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertTaxTemplateDto): Promise<TaxTemplate> {
    return this.taxTemplatesService.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermission('settings.write')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpsertTaxTemplateDto,
  ): Promise<TaxTemplate> {
    return this.taxTemplatesService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('settings.write')
  async deactivate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<TaxTemplate> {
    const taxTemplate = await this.taxTemplatesService.findOne(user.tenantId, id);
    if (!taxTemplate) throw new NotFoundException(`Tax template ${id} not found.`);
    return this.taxTemplatesService.deactivate(user.tenantId, id);
  }
}
