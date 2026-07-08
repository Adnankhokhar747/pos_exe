import { Body, Controller, Get, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CashDrawerSession } from '@prisma/client';
import { CashDrawerSessionsService } from './cash-drawer-sessions.service';
import { OpenCashDrawerDto, CloseCashDrawerDto } from './dto/cash-drawer.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { LicenseGuard } from '../licensing/license.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('api/v1/cash-drawer-sessions')
@UseGuards(JwtAuthGuard, LicenseGuard, PermissionsGuard)
export class CashDrawerSessionsController {
  constructor(
    private readonly cashDrawerSessionsService: CashDrawerSessionsService,
    private readonly prisma: PrismaService,
  ) {}

  private async assertBranchInTenant(tenantId: string, branchId: string): Promise<void> {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, tenantId } });
    if (!branch) throw new NotFoundException(`Branch ${branchId} not found.`);
  }

  @Get('current')
  async getCurrent(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId: string): Promise<CashDrawerSession | null> {
    await this.assertBranchInTenant(user.tenantId, branchId);
    return this.cashDrawerSessionsService.getCurrent(branchId);
  }

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId: string): Promise<CashDrawerSession[]> {
    await this.assertBranchInTenant(user.tenantId, branchId);
    return this.cashDrawerSessionsService.list(branchId);
  }

  @Post('open')
  async open(@CurrentUser() user: AuthenticatedUser, @Body() dto: OpenCashDrawerDto): Promise<CashDrawerSession> {
    await this.assertBranchInTenant(user.tenantId, dto.branchId);
    return this.cashDrawerSessionsService.open(dto.branchId, user.userId, dto.openingFloat);
  }

  @Post(':id/close')
  close(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CloseCashDrawerDto,
  ): Promise<CashDrawerSession> {
    return this.cashDrawerSessionsService.close(user.tenantId, id, user.userId, dto.closingCount);
  }
}
