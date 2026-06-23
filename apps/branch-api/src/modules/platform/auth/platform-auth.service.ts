import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../../../prisma/prisma.service';
import { InvalidCredentialsError } from '../../../common/exceptions/domain-exception';
import { PlatformAccessTokenPayload } from './platform-auth.types';

export interface PlatformLoginResult {
  accessToken: string;
  admin: {
    id: string;
    username: string;
    fullName: string;
  };
}

@Injectable()
export class PlatformAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(username: string, password: string): Promise<PlatformLoginResult> {
    const admin = await this.prisma.platformAdmin.findUnique({ where: { username } });
    if (!admin) {
      throw new InvalidCredentialsError();
    }

    const passwordValid = await argon2.verify(admin.passwordHash, password);
    if (!passwordValid) {
      throw new InvalidCredentialsError();
    }

    const payload: PlatformAccessTokenPayload = {
      sub: admin.id,
      username: admin.username,
      kind: 'platform-admin',
    };

    return {
      accessToken: this.jwtService.sign(payload),
      admin: { id: admin.id, username: admin.username, fullName: admin.fullName },
    };
  }
}
