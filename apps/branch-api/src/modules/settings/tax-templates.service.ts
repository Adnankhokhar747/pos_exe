import { Injectable } from '@nestjs/common';
import { Prisma, TaxTemplate } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertTaxTemplateDto } from './dto/upsert-tax-template.dto';

@Injectable()
export class TaxTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string): Promise<TaxTemplate[]> {
    return this.prisma.taxTemplate.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
  }

  findOne(tenantId: string, id: string): Promise<TaxTemplate | null> {
    return this.prisma.taxTemplate.findFirst({ where: { id, tenantId } });
  }

  deactivate(tenantId: string, id: string): Promise<TaxTemplate> {
    return this.prisma.taxTemplate.update({ where: { id }, data: { isActive: false } });
  }

  create(tenantId: string, dto: UpsertTaxTemplateDto): Promise<TaxTemplate> {
    return this.prisma.taxTemplate.create({
      data: {
        tenantId,
        name: dto.name,
        taxType: dto.taxType ?? 'custom',
        ratePct: new Prisma.Decimal(dto.ratePct),
        isInclusive: dto.isInclusive ?? false,
        isActive: dto.isActive ?? true,
      },
    });
  }

  update(tenantId: string, id: string, dto: UpsertTaxTemplateDto): Promise<TaxTemplate> {
    return this.prisma.taxTemplate.update({
      where: { id },
      data: {
        name: dto.name,
        taxType: dto.taxType,
        ratePct: new Prisma.Decimal(dto.ratePct),
        isInclusive: dto.isInclusive,
        isActive: dto.isActive,
      },
    });
  }
}
