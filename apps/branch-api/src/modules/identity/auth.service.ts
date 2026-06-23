import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { InvalidCredentialsError } from '../../common/exceptions/domain-exception';
import { AccessTokenPayload } from '../../common/auth/types';

export interface LoginResult {
  accessToken: string;
  user: {
    id: string;
    username: string;
    fullName: string;
    permissions: string[];
    branchId: string;
    branchName: string;
    warehouseId: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(username: string, password: string): Promise<LoginResult> {
    const user = await this.prisma.user.findFirst({
      where: { username, status: 'active' },
      include: {
        userRoles: {
          include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
        },
      },
    });

    if (!user || !user.passwordHash) {
      throw new InvalidCredentialsError();
    }

    const passwordValid = await argon2.verify(user.passwordHash, password);
    if (!passwordValid) {
      throw new InvalidCredentialsError();
    }

    const permissions = Array.from(
      new Set(
        user.userRoles.flatMap((userRole) =>
          userRole.role.rolePermissions.map((rolePermission) => rolePermission.permission.code),
        ),
      ),
    );

    // The renderer used to read ACTIVE_BRANCH_ID/ACTIVE_WAREHOUSE_ID from a build-time
    // env var, which only works for one branch baked into one build — a hard blocker
    // once a single branch-api/renderer build serves multiple tenants. Resolving the
    // user's branch (and its default warehouse) live at login lets the same build work
    // for any tenant/branch.
    const branch = await this.prisma.branch.findFirstOrThrow({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: 'asc' },
    });
    const warehouse = await this.prisma.warehouse.findFirstOrThrow({
      where: { branchId: branch.id },
      orderBy: { isDefault: 'desc' },
    });

    const payload: AccessTokenPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      username: user.username,
      permissions,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        permissions,
        branchId: branch.id,
        branchName: branch.name,
        warehouseId: warehouse.id,
      },
    };
  }
}
