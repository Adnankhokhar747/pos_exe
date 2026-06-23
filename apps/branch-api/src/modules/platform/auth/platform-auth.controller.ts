import { Body, Controller, Post } from '@nestjs/common';
import { PlatformAuthService, PlatformLoginResult } from './platform-auth.service';
import { PlatformLoginDto } from './dto/platform-login.dto';

@Controller('api/v1/platform/auth')
export class PlatformAuthController {
  constructor(private readonly platformAuthService: PlatformAuthService) {}

  @Post('login')
  login(@Body() dto: PlatformLoginDto): Promise<PlatformLoginResult> {
    return this.platformAuthService.login(dto.username, dto.password);
  }
}
