import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Permission, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { LicenseGuard } from '../licensing/license.guard';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';

@Controller('api/v1/roles')
@UseGuards(JwtAuthGuard, LicenseGuard, PermissionsGuard)
@RequirePermission('user.manage')
export class RolesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rolesService: RolesService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<Array<Role & { rolePermissions: { permission: Permission }[] }>> {
    return this.rolesService.list(user.tenantId);
  }

  @Get('permissions')
  listPermissions(): Promise<Permission[]> {
    return this.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { code: 'asc' }] });
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const role = await this.rolesService.findOne(user.tenantId, id);
    if (!role) throw new NotFoundException(`Role ${id} not found.`);
    return role;
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRoleDto) {
    return this.rolesService.create(user.tenantId, dto);
  }

  @Patch(':id')
  async update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateRoleDto) {
    const role = await this.rolesService.findOne(user.tenantId, id);
    if (!role) throw new NotFoundException(`Role ${id} not found.`);
    return this.rolesService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<Role> {
    const role = await this.rolesService.findOne(user.tenantId, id);
    if (!role) throw new NotFoundException(`Role ${id} not found.`);
    return this.rolesService.remove(user.tenantId, id);
  }
}
