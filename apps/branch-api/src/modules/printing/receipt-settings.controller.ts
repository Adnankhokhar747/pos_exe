import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ReceiptSettings } from '@prisma/client';
import { ReceiptSettingsService } from './receipt-settings.service';
import { UpdateReceiptSettingsDto } from './dto/update-receipt-settings.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { LicenseGuard } from '../licensing/license.guard';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';

@Controller('api/v1/settings/receipt-settings')
@UseGuards(JwtAuthGuard, LicenseGuard, PermissionsGuard)
export class ReceiptSettingsController {
  constructor(private readonly receiptSettingsService: ReceiptSettingsService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser): Promise<ReceiptSettings> {
    return this.receiptSettingsService.get(user.tenantId);
  }

  @Patch()
  @RequirePermission('settings.write')
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateReceiptSettingsDto): Promise<ReceiptSettings> {
    return this.receiptSettingsService.update(user.tenantId, dto);
  }
}
