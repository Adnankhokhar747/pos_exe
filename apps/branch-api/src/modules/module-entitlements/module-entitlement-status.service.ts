import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LimitExceededError } from '../../common/exceptions/domain-exception';

export interface ModuleStatus {
  moduleCode: string;
  name: string;
  enabled: boolean;
  blocked: boolean;
  daysUntilExpiry: number | null;
  inGracePeriod: boolean;
  expiryDate: Date | null;
  limits: Record<string, number | null> | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Generic per-tenant-per-module entitlement gate, mirroring LicenseStatusService's
// lazy-expiry-on-read pattern but orthogonal to the core Plan/TenantSubscription —
// a module can be enabled/disabled and expire independently of the tenant's base
// subscription. See docs context: this is the foundation new verticals (School,
// Restaurant, Pharmacy, ...) plug into without touching this file again.
@Injectable()
export class ModuleEntitlementService {
  constructor(private readonly prisma: PrismaService) {}

  async computeModuleStatus(tenantId: string, moduleCode: string): Promise<ModuleStatus> {
    const moduleCatalog = await this.prisma.moduleCatalog.findUnique({ where: { code: moduleCode } });
    if (!moduleCatalog) throw new NotFoundException(`Module "${moduleCode}" is not registered.`);

    const grant = await this.prisma.tenantModule.findUnique({
      where: { tenantId_moduleId: { tenantId, moduleId: moduleCatalog.id } },
    });

    if (!grant || !grant.enabled) {
      return {
        moduleCode,
        name: moduleCatalog.name,
        enabled: false,
        blocked: true,
        daysUntilExpiry: null,
        inGracePeriod: false,
        expiryDate: null,
        limits: (grant?.limits as Record<string, number | null> | null) ?? null,
      };
    }

    if (!grant.expiryDate) {
      // Enabled with no expiry set (e.g. a Super Admin grant with no fixed period) — open-ended.
      return {
        moduleCode,
        name: moduleCatalog.name,
        enabled: true,
        blocked: false,
        daysUntilExpiry: null,
        inGracePeriod: false,
        expiryDate: null,
        limits: (grant.limits as Record<string, number | null> | null) ?? null,
      };
    }

    const now = Date.now();
    const daysUntilExpiry = Math.ceil((grant.expiryDate.getTime() - now) / MS_PER_DAY);
    const graceMs = grant.gracePeriodDays * MS_PER_DAY;
    const inGracePeriod = daysUntilExpiry < 0 && now <= grant.expiryDate.getTime() + graceMs;
    const pastGrace = now > grant.expiryDate.getTime() + graceMs;

    if (pastGrace) {
      // Persisted lazily on read, same rationale as LicenseStatusService — no cron in this
      // codebase, expiry is enforced live.
      await this.prisma.tenantModule.update({ where: { id: grant.id }, data: { enabled: false } });
      return {
        moduleCode,
        name: moduleCatalog.name,
        enabled: false,
        blocked: true,
        daysUntilExpiry,
        inGracePeriod: false,
        expiryDate: grant.expiryDate,
        limits: (grant.limits as Record<string, number | null> | null) ?? null,
      };
    }

    return {
      moduleCode,
      name: moduleCatalog.name,
      enabled: true,
      blocked: false,
      daysUntilExpiry,
      inGracePeriod,
      expiryDate: grant.expiryDate,
      limits: (grant.limits as Record<string, number | null> | null) ?? null,
    };
  }

  async listForTenant(tenantId: string): Promise<ModuleStatus[]> {
    const modules = await this.prisma.moduleCatalog.findMany({ where: { isActive: true } });
    return Promise.all(modules.map((moduleCatalog) => this.computeModuleStatus(tenantId, moduleCatalog.code)));
  }

  // Limit *keys* are module-specific (doctorLimit vs a future module's tableLimit), so this
  // service can't count usage itself — the consuming module counts its own usage and calls
  // this generic check, exactly how invoice/user/branch counting lives in LicenseStatusService
  // but the *comparison* against the plan's limit is centralized there too. Here, centralizing
  // the comparison is all that's generic; counting stays with the domain module.
  async checkLimit(tenantId: string, moduleCode: string, limitKey: string, currentCount: number): Promise<void> {
    const status = await this.computeModuleStatus(tenantId, moduleCode);
    const limit = status.limits?.[limitKey];
    if (limit != null && currentCount >= limit) {
      throw new LimitExceededError(
        `${limitKey} limit reached (${limit}) for the ${status.name} module. Contact your Super Admin to increase it.`,
      );
    }
  }
}
