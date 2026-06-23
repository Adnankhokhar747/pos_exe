import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LicenseStatusService } from '../../licensing/license-status.service';
import { PlatformAuthGuard } from '../auth/platform-auth.guard';

interface AlertEntry {
  tenantId: string;
  tenantName: string;
  daysUntilExpiry: number;
  userCount: number;
  userLimit: number | null;
  invoiceCount: number;
  invoiceLimit: number | null;
}

export interface PlatformAlerts {
  expiringSoon: AlertEntry[];
  expired: AlertEntry[];
  nearInvoiceLimit: AlertEntry[];
  nearUserLimit: AlertEntry[];
}

const NEAR_LIMIT_RATIO = 0.9;

@Controller('api/v1/platform/alerts')
@UseGuards(PlatformAuthGuard)
export class AlertsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly licenseStatusService: LicenseStatusService,
  ) {}

  @Get()
  async getAlerts(): Promise<PlatformAlerts> {
    const tenants = await this.prisma.tenant.findMany({ select: { id: true, name: true } });

    const alerts: PlatformAlerts = { expiringSoon: [], expired: [], nearInvoiceLimit: [], nearUserLimit: [] };

    for (const tenant of tenants) {
      const status = await this.licenseStatusService.computeStatus(tenant.id);
      const entry: AlertEntry = {
        tenantId: tenant.id,
        tenantName: tenant.name,
        daysUntilExpiry: status.daysUntilExpiry,
        userCount: status.userCount,
        userLimit: status.userLimit,
        invoiceCount: status.invoiceCount,
        invoiceLimit: status.invoiceLimit,
      };

      if (status.subscriptionStatus === 'expired' || status.daysUntilExpiry < 0) {
        alerts.expired.push(entry);
      } else if (status.daysUntilExpiry <= 30) {
        alerts.expiringSoon.push(entry);
      }

      if (status.invoiceLimit !== null && status.invoiceCount / status.invoiceLimit >= NEAR_LIMIT_RATIO) {
        alerts.nearInvoiceLimit.push(entry);
      }
      if (status.userLimit !== null && status.userCount / status.userLimit >= NEAR_LIMIT_RATIO) {
        alerts.nearUserLimit.push(entry);
      }
    }

    return alerts;
  }
}
