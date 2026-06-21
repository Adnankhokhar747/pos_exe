import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AccessTokenPayload, AuthenticatedUser } from './types';

// Verifies the bearer access token issued by AuthService and attaches the
// resolved AuthenticatedUser to the request, consumed by PermissionsGuard
// and the @CurrentUser() decorator. See docs/03-backend-architecture.md §5.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    try {
      const payload = this.jwtService.verify<AccessTokenPayload>(token);
      request.user = {
        userId: payload.sub,
        tenantId: payload.tenantId,
        username: payload.username,
        permissions: payload.permissions,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token.');
    }
  }

  private extractToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return undefined;
    return header.slice('Bearer '.length);
  }
}
