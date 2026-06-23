import { Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { LicenseStatusService } from '../licensing/license-status.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const USER_SELECT = {
  id: true,
  fullName: true,
  username: true,
  email: true,
  status: true,
  createdAt: true,
  userRoles: { include: { role: true } },
} as const;

export type UserWithRoles = Awaited<ReturnType<UsersService['list']>>[number];

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly licenseStatusService: LicenseStatusService,
  ) {}

  list(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: USER_SELECT,
      orderBy: { fullName: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, tenantId }, select: USER_SELECT });
    if (!user) throw new NotFoundException(`User ${id} not found.`);
    return user;
  }

  async create(tenantId: string, dto: CreateUserDto) {
    await this.licenseStatusService.checkUserLimit(tenantId);

    const role = await this.prisma.role.findFirst({ where: { id: dto.roleId, tenantId } });
    if (!role) throw new NotFoundException(`Role ${dto.roleId} not found.`);

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        tenantId,
        fullName: dto.fullName,
        username: dto.username,
        email: dto.email,
        passwordHash,
      },
    });

    await this.prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });

    return this.findOne(tenantId, user.id);
  }

  async update(tenantId: string, id: string, dto: UpdateUserDto) {
    await this.findOne(tenantId, id);

    if (dto.roleId) {
      const role = await this.prisma.role.findFirst({ where: { id: dto.roleId, tenantId } });
      if (!role) throw new NotFoundException(`Role ${dto.roleId} not found.`);
      await this.prisma.userRole.deleteMany({ where: { userId: id } });
      await this.prisma.userRole.create({ data: { userId: id, roleId: role.id } });
    }

    const passwordHash = dto.password ? await argon2.hash(dto.password) : undefined;

    await this.prisma.user.update({
      where: { id },
      data: {
        fullName: dto.fullName,
        email: dto.email,
        status: dto.status,
        passwordHash,
      },
    });

    return this.findOne(tenantId, id);
  }

  async deactivate(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.user.update({ where: { id }, data: { status: 'inactive' } });
    return this.findOne(tenantId, id);
  }
}
