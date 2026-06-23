import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AuthenticatedPlatformAdmin, PlatformAccessTokenPayload } from './platform-auth.types';

// Verifies the platform-admin bearer token, signed with PLATFORM_JWT_SECRET via this
// module's own JwtModule registration — entirely separate from the tenant-side
// JwtAuthGuard/JWT_SECRET so a tenant user's token can never authenticate here.
@Injectable()
export class PlatformAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { platformAdmin?: AuthenticatedPlatformAdmin }>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    try {
      const payload = this.jwtService.verify<PlatformAccessTokenPayload>(token);
      if (payload.kind !== 'platform-admin') {
        throw new UnauthorizedException('Invalid token.');
      }
      request.platformAdmin = { adminId: payload.sub, username: payload.username };
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
