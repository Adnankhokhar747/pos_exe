import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { CashDrawerSessionsController } from './cash-drawer-sessions.controller';
import { CashDrawerSessionsService } from './cash-drawer-sessions.service';
import { IdentityModule } from '../identity/identity.module';
import { CustomersModule } from '../customers/customers.module';

@Module({
  imports: [IdentityModule, CustomersModule],
  controllers: [InvoicesController, CashDrawerSessionsController],
  providers: [InvoicesService, CashDrawerSessionsService],
})
export class SalesModule {}
