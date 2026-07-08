import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Branch } from '@prisma/client';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { LicenseGuard } from '../licensing/license.guard';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';

@Controller('api/v1/branches')
@UseGuards(JwtAuthGuard, LicenseGuard, PermissionsGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<Branch[]> {
    return this.branchesService.list(user.tenantId);
  }

  @Post()
  @RequirePermission('settings.write')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBranchDto): Promise<Branch> {
    return this.branchesService.create(user.tenantId, dto);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<Branch> {
    const branch = await this.branchesService.findOne(user.tenantId, id);
    if (!branch) throw new NotFoundException(`Branch ${id} not found.`);
    return branch;
  }

  @Patch(':id')
  @RequirePermission('settings.write')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
  ): Promise<Branch> {
    const branch = await this.branchesService.findOne(user.tenantId, id);
    if (!branch) throw new NotFoundException(`Branch ${id} not found.`);
    return this.branchesService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('settings.write')
  async deactivate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<Branch> {
    const branch = await this.branchesService.findOne(user.tenantId, id);
    if (!branch) throw new NotFoundException(`Branch ${id} not found.`);
    return this.branchesService.deactivate(user.tenantId, id);
  }
}
