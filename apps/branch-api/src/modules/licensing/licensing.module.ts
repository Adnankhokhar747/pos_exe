import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { LicenseStatusService } from './license-status.service';
import { LicenseController } from './license.controller';
import { LicenseGuard } from './license.guard';

// Registers its own JwtModule (same secret/expiry as IdentityModule) rather than
// importing IdentityModule directly — IdentityModule imports LicensingModule (for
// LicenseGuard on AuthController.me), so importing it back here would be circular.
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-only-insecure-secret-change-me',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [LicenseController],
  providers: [LicenseStatusService, LicenseGuard],
  exports: [LicenseStatusService, LicenseGuard],
})
export class LicensingModule {}
