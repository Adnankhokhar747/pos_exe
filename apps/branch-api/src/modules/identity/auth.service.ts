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
      },
    };
  }
}
