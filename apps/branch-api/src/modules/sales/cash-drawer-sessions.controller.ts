import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CashDrawerSession } from '@prisma/client';
import { CashDrawerSessionsService } from './cash-drawer-sessions.service';
import { OpenCashDrawerDto, CloseCashDrawerDto } from './dto/cash-drawer.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';

@Controller('api/v1/cash-drawer-sessions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CashDrawerSessionsController {
  constructor(private readonly cashDrawerSessionsService: CashDrawerSessionsService) {}

  @Get('current')
  getCurrent(@Query('branchId') branchId: string): Promise<CashDrawerSession | null> {
    return this.cashDrawerSessionsService.getCurrent(branchId);
  }

  @Get()
  list(@Query('branchId') branchId: string): Promise<CashDrawerSession[]> {
    return this.cashDrawerSessionsService.list(branchId);
  }

  @Post('open')
  open(@CurrentUser() user: AuthenticatedUser, @Body() dto: OpenCashDrawerDto): Promise<CashDrawerSession> {
    return this.cashDrawerSessionsService.open(dto.branchId, user.userId, dto.openingFloat);
  }

  @Post(':id/close')
  close(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CloseCashDrawerDto,
  ): Promise<CashDrawerSession> {
    return this.cashDrawerSessionsService.close(id, user.userId, dto.closingCount);
  }
}
