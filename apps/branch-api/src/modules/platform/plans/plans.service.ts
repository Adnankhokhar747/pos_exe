import { Injectable, NotFoundException } from '@nestjs/common';
import { Plan } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<Plan[]> {
    return this.prisma.plan.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async findOne(id: string): Promise<Plan> {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException(`Plan ${id} not found.`);
    return plan;
  }

  create(dto: CreatePlanDto): Promise<Plan> {
    return this.prisma.plan.create({
      data: {
        name: dto.name,
        userLimit: dto.userLimit ?? null,
        invoiceLimit: dto.invoiceLimit ?? null,
        branchLimit: dto.branchLimit ?? null,
        priceMonthly: dto.priceMonthly ?? null,
      },
    });
  }

  async update(id: string, dto: UpdatePlanDto): Promise<Plan> {
    await this.findOne(id);
    return this.prisma.plan.update({
      where: { id },
      data: {
        name: dto.name,
        userLimit: dto.userLimit,
        invoiceLimit: dto.invoiceLimit,
        branchLimit: dto.branchLimit,
        priceMonthly: dto.priceMonthly,
        isActive: dto.isActive,
      },
    });
  }

  async deactivate(id: string): Promise<Plan> {
    await this.findOne(id);
    return this.prisma.plan.update({ where: { id }, data: { isActive: false } });
  }
}
