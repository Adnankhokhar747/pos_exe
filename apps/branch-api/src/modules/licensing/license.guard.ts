import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { LicenseStatusService } from './license-status.service';
import { LicenseBlockedError } from '../../common/exceptions/domain-exception';
import { AuthenticatedUser } from '../../common/auth/types';

// Runs after JwtAuthGuard on every guarded route, re-checking the user/tenant/
// subscription state live against the database rather than trusting the cached
// JWT — the token is valid for 15 minutes, during which a subscription could
// expire or an admin could deactivate the user. See docs/00-functional-specification.md
// requirement #17 (every request validates company/subscription/user/license).
@Injectable()
export class LicenseGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly licenseStatusService: LicenseStatusService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    const { tenantId, userId } = request.user;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'active') {
      throw new LicenseBlockedError('This user account has been deactivated.');
    }

    const status = await this.licenseStatusService.computeStatus(tenantId);
    if (status.blocked) {
      throw new LicenseBlockedError(status.message ?? 'Access is blocked for this company.');
    }

    return true;
  }
}
