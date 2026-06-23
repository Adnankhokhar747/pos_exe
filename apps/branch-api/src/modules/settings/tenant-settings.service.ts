import { Injectable } from '@nestjs/common';
import { Tenant } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';

const SELECT = {
  id: true,
  name: true,
  baseCurrency: true,
  address: true,
  taxNumber: true,
  logoPath: true,
  defaultTaxTemplateId: true,
} as const;

type TenantSettingsShape = Pick<
  Tenant,
  'id' | 'name' | 'baseCurrency' | 'address' | 'taxNumber' | 'logoPath' | 'defaultTaxTemplateId'
>;

@Injectable()
export class TenantSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  get(tenantId: string): Promise<TenantSettingsShape> {
    return this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: SELECT });
  }

  update(tenantId: string, dto: UpdateTenantSettingsDto): Promise<TenantSettingsShape> {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: dto.name,
        baseCurrency: dto.baseCurrency,
        address: dto.address,
        taxNumber: dto.taxNumber,
        logoPath: dto.logoPath,
        defaultTaxTemplateId: dto.defaultTaxTemplateId,
      },
      select: SELECT,
    });
  }
}
