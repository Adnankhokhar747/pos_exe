import { Controller, Get, UseGuards } from '@nestjs/common';
import { LicenseStatusService, LicenseStatus } from './license-status.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';

@Controller('api/v1/license')
@UseGuards(JwtAuthGuard)
export class LicenseController {
  constructor(private readonly licenseStatusService: LicenseStatusService) {}

  @Get('status')
  getStatus(@CurrentUser() user: AuthenticatedUser): Promise<LicenseStatus> {
    return this.licenseStatusService.computeStatus(user.tenantId);
  }
}
