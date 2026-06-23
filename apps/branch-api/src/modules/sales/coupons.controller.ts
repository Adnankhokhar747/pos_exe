import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Coupon, Prisma } from '@prisma/client';
import { CouponsService } from './coupons.service';
import { UpsertCouponDto } from './dto/upsert-coupon.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { LicenseGuard } from '../licensing/license.guard';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';

@Controller('api/v1/coupons')
@UseGuards(JwtAuthGuard, LicenseGuard, PermissionsGuard)
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<Coupon[]> {
    return this.couponsService.list(user.tenantId);
  }

  @Post()
  @RequirePermission('settings.write')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertCouponDto): Promise<Coupon> {
    return this.couponsService.create(user.tenantId, dto);
  }

  @Get('validate')
  async validate(@CurrentUser() user: AuthenticatedUser, @Query('code') code: string, @Query('subtotal') subtotal: string) {
    const { discount } = await this.couponsService.validate(user.tenantId, code, new Prisma.Decimal(subtotal));
    return { valid: true, discount: discount.toString() };
  }
}
