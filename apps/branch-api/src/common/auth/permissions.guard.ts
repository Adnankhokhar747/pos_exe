import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PERMISSION_KEY } from './require-permission.decorator';
import { AuthenticatedUser } from './types';

// Checks the caller's cached permission set (from the JWT) against the
// @RequirePermission() decorator on the route. Must run after JwtAuthGuard.
// See docs/03-backend-architecture.md §5 and docs/11-security-design.md §3.
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    const granted = request.user?.permissions ?? [];
    if (!granted.includes(required)) {
      throw new ForbiddenException(`Missing required permission: ${required}`);
    }
    return true;
  }
}
