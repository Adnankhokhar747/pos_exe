import { Module } from '@nestjs/common';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { GoodsReceiptsController } from './goods-receipts.controller';
import { GoodsReceiptsService } from './goods-receipts.service';
import { SupplierInvoicesController } from './supplier-invoices.controller';
import { SupplierInvoicesService } from './supplier-invoices.service';
import { SupplierPaymentsController } from './supplier-payments.controller';
import { SupplierPaymentsService } from './supplier-payments.service';
import { IdentityModule } from '../identity/identity.module';
import { SuppliersModule } from '../suppliers/suppliers.module';

@Module({
  imports: [IdentityModule, SuppliersModule],
  controllers: [
    PurchaseOrdersController,
    GoodsReceiptsController,
    SupplierInvoicesController,
    SupplierPaymentsController,
  ],
  providers: [PurchaseOrdersService, GoodsReceiptsService, SupplierInvoicesService, SupplierPaymentsService],
})
export class PurchasingModule {}
