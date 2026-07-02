import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ModuleEntitlementService } from './module-entitlement-status.service';
import { ModuleStatusController } from './module-status.controller';
import { ModuleGuard } from './module.guard';

// Registers its own JwtModule (same secret/expiry as IdentityModule/LicensingModule)
// so JwtAuthGuard resolves wherever this module is imported standalone — same
// circular-import constraint documented in licensing.module.ts.
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-only-insecure-secret-change-me',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [ModuleStatusController],
  providers: [ModuleEntitlementService, ModuleGuard],
  exports: [ModuleEntitlementService, ModuleGuard],
})
export class ModuleEntitlementsModule {}
