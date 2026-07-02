import { Injectable, NotFoundException } from '@nestjs/common';
import { ModuleCatalog } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateModuleCatalogDto } from './dto/create-module-catalog.dto';
import { UpdateModuleCatalogDto } from './dto/update-module-catalog.dto';

@Injectable()
export class ModulesCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<ModuleCatalog[]> {
    return this.prisma.moduleCatalog.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async findOne(id: string): Promise<ModuleCatalog> {
    const moduleCatalog = await this.prisma.moduleCatalog.findUnique({ where: { id } });
    if (!moduleCatalog) throw new NotFoundException(`Module ${id} not found.`);
    return moduleCatalog;
  }

  create(dto: CreateModuleCatalogDto): Promise<ModuleCatalog> {
    return this.prisma.moduleCatalog.create({
      data: { code: dto.code, name: dto.name, description: dto.description },
    });
  }

  async update(id: string, dto: UpdateModuleCatalogDto): Promise<ModuleCatalog> {
    await this.findOne(id);
    return this.prisma.moduleCatalog.update({
      where: { id },
      data: { name: dto.name, description: dto.description, isActive: dto.isActive },
    });
  }
}
