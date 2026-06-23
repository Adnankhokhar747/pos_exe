import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedPlatformAdmin } from './platform-auth.types';

export const CurrentPlatformAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedPlatformAdmin => {
    const request = ctx.switchToHttp().getRequest<Request & { platformAdmin: AuthenticatedPlatformAdmin }>();
    return request.platformAdmin;
  },
);
