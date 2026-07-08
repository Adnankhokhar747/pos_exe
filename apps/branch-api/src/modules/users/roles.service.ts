import { Injectable } from '@nestjs/common';
import { Permission, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RoleInUseError, SystemRoleImmutableError } from '../../common/exceptions/domain-exception';

type RoleWithPermissions = Role & { rolePermissions: { permission: Permission }[] };

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string): Promise<RoleWithPermissions[]> {
    return this.prisma.role.findMany({
      where: { tenantId },
      include: { rolePermissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });
  }

  findOne(tenantId: string, id: string): Promise<RoleWithPermissions | null> {
    return this.prisma.role.findFirst({
      where: { id, tenantId },
      include: { rolePermissions: { include: { permission: true } } },
    });
  }

  async create(tenantId: string, dto: CreateRoleDto): Promise<RoleWithPermissions> {
    const permissions = await this.prisma.permission.findMany({ where: { code: { in: dto.permissionCodes } } });
    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({ data: { tenantId, name: dto.name } });
      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
        });
      }
      return tx.role.findUniqueOrThrow({
        where: { id: role.id },
        include: { rolePermissions: { include: { permission: true } } },
      });
    });
  }

  async update(tenantId: string, id: string, dto: UpdateRoleDto): Promise<RoleWithPermissions> {
    const role = await this.prisma.role.findFirstOrThrow({ where: { id, tenantId } });
    if (role.isSystemRole) throw new SystemRoleImmutableError(role.name);

    return this.prisma.$transaction(async (tx) => {
      if (dto.name !== undefined) {
        await tx.role.update({ where: { id }, data: { name: dto.name } });
      }
      if (dto.permissionCodes !== undefined) {
        const permissions = await tx.permission.findMany({ where: { code: { in: dto.permissionCodes } } });
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        if (permissions.length > 0) {
          await tx.rolePermission.createMany({
            data: permissions.map((p) => ({ roleId: id, permissionId: p.id })),
          });
        }
      }
      return tx.role.findUniqueOrThrow({
        where: { id },
        include: { rolePermissions: { include: { permission: true } } },
      });
    });
  }

  async remove(tenantId: string, id: string): Promise<Role> {
    const role = await this.prisma.role.findFirstOrThrow({ where: { id, tenantId } });
    if (role.isSystemRole) throw new SystemRoleImmutableError(role.name);

    const assignedUserCount = await this.prisma.userRole.count({ where: { roleId: id } });
    if (assignedUserCount > 0) throw new RoleInUseError(assignedUserCount);

    return this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      return tx.role.delete({ where: { id } });
    });
  }
}
