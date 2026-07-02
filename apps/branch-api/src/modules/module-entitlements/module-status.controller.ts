import { Controller, Get, UseGuards } from '@nestjs/common';
import { ModuleEntitlementService, ModuleStatus } from './module-entitlement-status.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';

// Deliberately NOT behind LicenseGuard — same reasoning as LicenseController itself
// being license-guard-exempt: the renderer must always be able to ask "what's my
// module status" even while license-blocked, so it can render the right screen
// instead of looping on a guarded call.
@Controller('api/v1/modules')
@UseGuards(JwtAuthGuard)
export class ModuleStatusController {
  constructor(private readonly moduleEntitlementService: ModuleEntitlementService) {}

  @Get('status')
  listForTenant(@CurrentUser() user: AuthenticatedUser): Promise<ModuleStatus[]> {
    return this.moduleEntitlementService.listForTenant(user.tenantId);
  }
}
