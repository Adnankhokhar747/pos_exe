import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { CashDrawerSessionsController } from './cash-drawer-sessions.controller';
import { CashDrawerSessionsService } from './cash-drawer-sessions.service';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';
import { GiftCardsController } from './gift-cards.controller';
import { GiftCardsService } from './gift-cards.service';
import { IdentityModule } from '../identity/identity.module';
import { LicensingModule } from '../licensing/licensing.module';
import { CustomersModule } from '../customers/customers.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [IdentityModule, LicensingModule, CustomersModule, SettingsModule],
  controllers: [InvoicesController, CashDrawerSessionsController, CouponsController, GiftCardsController],
  providers: [InvoicesService, CashDrawerSessionsService, CouponsService, GiftCardsService],
  exports: [CouponsService, GiftCardsService],
})
export class SalesModule {}
