import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'requiredPermission';

// Usage: @RequirePermission('pos.sale.create') — enforced by PermissionsGuard.
// Permission codes are the catalog defined in docs/00-functional-specification.md §15.
export const RequirePermission = (code: string): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSION_KEY, code);
