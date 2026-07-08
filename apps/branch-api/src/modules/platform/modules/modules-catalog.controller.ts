import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ModuleCatalog } from '@prisma/client';
import { ModulesCatalogService } from './modules-catalog.service';
import { CreateModuleCatalogDto } from './dto/create-module-catalog.dto';
import { UpdateModuleCatalogDto } from './dto/update-module-catalog.dto';
import { PlatformAuthGuard } from '../auth/platform-auth.guard';

@Controller('api/v1/platform/modules')
@UseGuards(PlatformAuthGuard)
export class ModulesCatalogController {
  constructor(private readonly modulesCatalogService: ModulesCatalogService) {}

  @Get()
  list(): Promise<ModuleCatalog[]> {
    return this.modulesCatalogService.list();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<ModuleCatalog> {
    return this.modulesCatalogService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateModuleCatalogDto): Promise<ModuleCatalog> {
    return this.modulesCatalogService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateModuleCatalogDto): Promise<ModuleCatalog> {
    return this.modulesCatalogService.update(id, dto);
  }

  @Delete(':id')
  deactivate(@Param('id') id: string): Promise<ModuleCatalog> {
    return this.modulesCatalogService.deactivate(id);
  }
}
