import { Module } from '@nestjs/common';
import { StockAdjustmentsController } from './stock-adjustments.controller';
import { StockAdjustmentsService } from './stock-adjustments.service';
import { StockTransfersController } from './stock-transfers.controller';
import { StockTransfersService } from './stock-transfers.service';
import { BatchesController } from './batches.controller';
import { BatchesService } from './batches.service';
import { SerialNumbersController } from './serial-numbers.controller';
import { SerialNumbersService } from './serial-numbers.service';
import { IdentityModule } from '../identity/identity.module';
import { LicensingModule } from '../licensing/licensing.module';

@Module({
  imports: [IdentityModule, LicensingModule],
  controllers: [StockAdjustmentsController, StockTransfersController, BatchesController, SerialNumbersController],
  providers: [StockAdjustmentsService, StockTransfersService, BatchesService, SerialNumbersService],
  exports: [BatchesService],
})
export class InventoryModule {}
