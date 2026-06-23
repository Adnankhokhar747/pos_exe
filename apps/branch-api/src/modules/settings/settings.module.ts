import { Module } from '@nestjs/common';
import { CurrenciesController } from './currencies.controller';
import { CurrenciesService } from './currencies.service';
import { TaxTemplatesController } from './tax-templates.controller';
import { TaxTemplatesService } from './tax-templates.service';
import { TenantSettingsController } from './tenant-settings.controller';
import { TenantSettingsService } from './tenant-settings.service';
import { IdentityModule } from '../identity/identity.module';
import { LicensingModule } from '../licensing/licensing.module';

@Module({
  imports: [IdentityModule, LicensingModule],
  controllers: [CurrenciesController, TaxTemplatesController, TenantSettingsController],
  providers: [CurrenciesService, TaxTemplatesService, TenantSettingsService],
  exports: [CurrenciesService, TaxTemplatesService, TenantSettingsService],
})
export class SettingsModule {}
