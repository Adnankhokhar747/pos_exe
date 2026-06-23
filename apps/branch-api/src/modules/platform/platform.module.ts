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
import { LicensingModule } from '../licensing/licensing.module';

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
  ],
  controllers: [PlatformAuthController, CompaniesController, AlertsController, PlansController],
  providers: [PlatformAuthService, PlatformAuthGuard, CompaniesService, PlansService],
})
export class PlatformModule {}
