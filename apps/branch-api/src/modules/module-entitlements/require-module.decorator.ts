import { SetMetadata } from '@nestjs/common';

export const MODULE_KEY = 'requiredModuleCode';

// Usage: @RequireModule('hospital') — enforced by ModuleGuard. Exact mirror of
// RequirePermission/PermissionsGuard, one layer up (whole-module gating, not a
// single permission).
export const RequireModule = (code: string): MethodDecorator & ClassDecorator =>
  SetMetadata(MODULE_KEY, code);
