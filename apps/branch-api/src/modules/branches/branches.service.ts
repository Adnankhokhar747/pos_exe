import { Injectable } from '@nestjs/common';
import { Branch } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LicenseStatusService } from '../licensing/license-status.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { LastActiveBranchError } from '../../common/exceptions/domain-exception';

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly licenseStatusService: LicenseStatusService,
  ) {}

  list(tenantId: string): Promise<Branch[]> {
    return this.prisma.branch.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
  }

  findOne(tenantId: string, id: string): Promise<Branch | null> {
    return this.prisma.branch.findFirst({ where: { id, tenantId } });
  }

  update(tenantId: string, id: string, dto: UpdateBranchDto): Promise<Branch> {
    return this.prisma.branch.update({ where: { id }, data: { ...dto } });
  }

  async deactivate(tenantId: string, id: string): Promise<Branch> {
    const activeCount = await this.prisma.branch.count({ where: { tenantId, isActive: true } });
    const target = await this.prisma.branch.findFirst({ where: { id, tenantId } });
    if (activeCount <= 1 && target?.isActive) throw new LastActiveBranchError();
    return this.prisma.branch.update({ where: { id }, data: { isActive: false } });
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
