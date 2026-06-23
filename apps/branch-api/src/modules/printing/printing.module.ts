import { Module } from '@nestjs/common';
import { PrintersController } from './printers.controller';
import { PrintersService } from './printers.service';
import { ReceiptSettingsController } from './receipt-settings.controller';
import { ReceiptSettingsService } from './receipt-settings.service';
import { IdentityModule } from '../identity/identity.module';
import { LicensingModule } from '../licensing/licensing.module';

@Module({
  imports: [IdentityModule, LicensingModule],
  controllers: [PrintersController, ReceiptSettingsController],
  providers: [PrintersService, ReceiptSettingsService],
  exports: [PrintersService, ReceiptSettingsService],
})
export class PrintingModule {}
