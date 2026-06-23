import { Injectable } from '@nestjs/common';
import { Branch } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LicenseStatusService } from '../licensing/license-status.service';
import { CreateBranchDto } from './dto/create-branch.dto';

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly licenseStatusService: LicenseStatusService,
  ) {}

  list(tenantId: string): Promise<Branch[]> {
    return this.prisma.branch.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
  }

  async create(tenantId: string, dto: CreateBranchDto): Promise<Branch> {
    await this.licenseStatusService.checkBranchLimit(tenantId);

    const branch = await this.prisma.branch.create({
      data: { tenantId, name: dto.name, code: dto.code },
    });
    await this.prisma.warehouse.create({
      data: { branchId: branch.id, name: `${dto.name} Warehouse`, isDefault: true },
    });

    return branch;
  }
}
