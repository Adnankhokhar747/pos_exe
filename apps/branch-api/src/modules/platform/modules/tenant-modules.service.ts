import { Injectable, NotFoundException } from '@nestjs/common';
import { ModuleEntitlementService, ModuleStatus } from '../../module-entitlements/module-entitlement-status.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpsertTenantModuleDto } from './dto/upsert-tenant-module.dto';

export interface TenantModuleGrant extends ModuleStatus {
  moduleId: string;
}

@Injectable()
export class TenantModulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moduleEntitlementService: ModuleEntitlementService,
  ) {}

  async listForCompany(tenantId: string): Promise<TenantModuleGrant[]> {
    await this.ensureTenantExists(tenantId);
    const catalog = await this.prisma.moduleCatalog.findMany({ orderBy: { createdAt: 'asc' } });
    return Promise.all(
      catalog.map(async (moduleCatalog) => ({
        moduleId: moduleCatalog.id,
        ...(await this.moduleEntitlementService.computeModuleStatus(tenantId, moduleCatalog.code)),
      })),
    );
  }

  async upsert(tenantId: string, moduleCode: string, dto: UpsertTenantModuleDto): Promise<TenantModuleGrant> {
    await this.ensureTenantExists(tenantId);
    const moduleCatalog = await this.prisma.moduleCatalog.findUnique({ where: { code: moduleCode } });
    if (!moduleCatalog) throw new NotFoundException(`Module "${moduleCode}" is not registered.`);

    const existing = await this.prisma.tenantModule.findUnique({
      where: { tenantId_moduleId: { tenantId, moduleId: moduleCatalog.id } },
    });

    let expiryDate: Date | null | undefined = existing?.expiryDate ?? null;
    let startDate: Date | null | undefined = existing?.startDate ?? null;
    if (dto.enabled) {
      const periodMonths = dto.periodMonths ?? 12;
      startDate = existing?.startDate ?? new Date();
      expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + periodMonths);
    }

    await this.prisma.tenantModule.upsert({
      where: { tenantId_moduleId: { tenantId, moduleId: moduleCatalog.id } },
      create: {
        tenantId,
        moduleId: moduleCatalog.id,
        enabled: dto.enabled,
        startDate,
        expiryDate,
        gracePeriodDays: dto.gracePeriodDays ?? 7,
        limits: dto.limits ?? undefined,
      },
      update: {
        enabled: dto.enabled,
        startDate,
        expiryDate,
        ...(dto.gracePeriodDays != null ? { gracePeriodDays: dto.gracePeriodDays } : {}),
        ...(dto.limits != null ? { limits: dto.limits } : {}),
      },
    });

    return {
      moduleId: moduleCatalog.id,
      ...(await this.moduleEntitlementService.computeModuleStatus(tenantId, moduleCode)),
    };
  }

  private async ensureTenantExists(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException(`Company ${tenantId} not found.`);
  }
}
