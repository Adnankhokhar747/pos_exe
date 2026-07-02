import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ModuleEntitlementService } from './module-entitlement-status.service';
import { MODULE_KEY } from './require-module.decorator';
import { ModuleBlockedError } from '../../common/exceptions/domain-exception';
import { AuthenticatedUser } from '../../common/auth/types';

// Runs after JwtAuthGuard (needs request.user) and after LicenseGuard (a suspended/
// expired tenant should see the coarser license-blocked message before a module-
// specific one) and before PermissionsGuard ("this whole module is off" is a more
// fundamental rejection reason than "you lack this one permission"). Guard order on
// module-gated controllers: @UseGuards(JwtAuthGuard, LicenseGuard, ModuleGuard, PermissionsGuard).
@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly moduleEntitlementService: ModuleEntitlementService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string | undefined>(MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    const status = await this.moduleEntitlementService.computeModuleStatus(request.user.tenantId, required);
    if (status.blocked) {
      throw new ModuleBlockedError(
        `The ${status.name} module is not enabled for this company. Contact your Super Admin.`,
      );
    }
    return true;
  }
}
