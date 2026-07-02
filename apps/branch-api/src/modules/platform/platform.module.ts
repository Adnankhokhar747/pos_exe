import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PlatformAuthController } from './auth/platform-auth.controller';
import { PlatformAuthService } from './auth/platform-auth.service';
import { PlatformAuthGuard } from './auth/platform-auth.guard';
import { CompaniesController } from './companies/companies.controller';
import { CompaniesService } from './companies/companies.service';
import { AlertsController } from './alerts/alerts.controller';
import { PlansController } from './plans/plans.controller';
import { PlansService } from './plans/plans.service';
import { ModulesCatalogController } from './modules/modules-catalog.controller';
import { ModulesCatalogService } from './modules/modules-catalog.service';
import { TenantModulesController } from './modules/tenant-modules.controller';
import { TenantModulesService } from './modules/tenant-modules.service';
import { LicensingModule } from '../licensing/licensing.module';
import { ModuleEntitlementsModule } from '../module-entitlements/module-entitlements.module';

// Deliberately does not import IdentityModule — platform-admin auth is fully isolated
// from tenant auth (separate secret, separate JWT claim, separate guard) so a tenant
// user's token can never be valid here and vice versa.
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.PLATFORM_JWT_SECRET ?? 'dev-only-insecure-platform-secret-change-me',
      signOptions: { expiresIn: '15m' },
    }),
    LicensingModule,
    ModuleEntitlementsModule,
  ],
  controllers: [
    PlatformAuthController,
    CompaniesController,
    AlertsController,
    PlansController,
    ModulesCatalogController,
    TenantModulesController,
  ],
  providers: [
    PlatformAuthService,
    PlatformAuthGuard,
    CompaniesService,
    PlansService,
    ModulesCatalogService,
    TenantModulesService,
  ],
})
export class PlatformModule {}
