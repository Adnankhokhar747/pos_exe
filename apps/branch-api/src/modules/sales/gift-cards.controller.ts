import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { GiftCard } from '@prisma/client';
import { GiftCardsService } from './gift-cards.service';
import { IssueGiftCardDto } from './dto/issue-gift-card.dto';
import { ReloadGiftCardDto } from './dto/reload-gift-card.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { LicenseGuard } from '../licensing/license.guard';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';

@Controller('api/v1/gift-cards')
@UseGuards(JwtAuthGuard, LicenseGuard, PermissionsGuard)
export class GiftCardsController {
  constructor(private readonly giftCardsService: GiftCardsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<GiftCard[]> {
    return this.giftCardsService.list(user.tenantId);
  }

  @Post()
  @RequirePermission('settings.write')
  issue(@CurrentUser() user: AuthenticatedUser, @Body() dto: IssueGiftCardDto): Promise<GiftCard> {
    return this.giftCardsService.issue(user.tenantId, dto);
  }

  @Get(':code/balance')
  getBalance(@CurrentUser() user: AuthenticatedUser, @Param('code') code: string) {
    return this.giftCardsService.getBalance(user.tenantId, code);
  }

  @Post(':code/reload')
  @RequirePermission('settings.write')
  reload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('code') code: string,
    @Body() dto: ReloadGiftCardDto,
  ): Promise<GiftCard> {
    return this.giftCardsService.reload(user.tenantId, code, dto.amount);
  }
}
