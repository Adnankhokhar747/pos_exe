import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { IdentityModule } from './modules/identity/identity.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { SalesModule } from './modules/sales/sales.module';
import { HealthController } from './modules/health/health.controller';
import { DomainExceptionFilter } from './common/filters/domain-exception.filter';

@Module({
  imports: [PrismaModule, IdentityModule, CatalogModule, SalesModule],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: DomainExceptionFilter }],
})
export class AppModule {}
