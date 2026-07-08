import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AccountingService, ProfitSummary } from './accounting.service';
import {
  CreateDailyClosingDto,
  CreateExpenseCategoryDto,
  CreateExpenseDto,
  CreateIncomeDto,
} from './dto/create-expense.dto';
import { UpdateDailyClosingDto, UpdateExpenseDto, UpdateIncomeDto, VoidRecordDto } from './dto/update-expense.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { LicenseGuard } from '../licensing/license.guard';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';

@Controller('api/v1')
@UseGuards(JwtAuthGuard, LicenseGuard, PermissionsGuard)
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get('expense-categories')
  listExpenseCategories(@CurrentUser() user: AuthenticatedUser) {
    return this.accountingService.listExpenseCategories(user.tenantId);
  }

  @Post('expense-categories')
  @RequirePermission('accounting.write')
  createExpenseCategory(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateExpenseCategoryDto) {
    return this.accountingService.createExpenseCategory(user.tenantId, dto);
  }

  @Get('expenses')
  listExpenses(@Query('branchId') branchId: string) {
    return this.accountingService.listExpenses(branchId);
  }

  @Post('expenses')
  @RequirePermission('accounting.write')
  createExpense(@Body() dto: CreateExpenseDto) {
    return this.accountingService.createExpense(dto);
  }

  @Get('expenses/:id')
  findExpense(@Param('id') id: string) {
    return this.accountingService.findExpense(id);
  }

  @Patch('expenses/:id')
  @RequirePermission('accounting.write')
  updateExpense(@Param('id') id: string, @Body() dto: UpdateExpenseDto) {
    return this.accountingService.updateExpense(id, dto);
  }

  @Post('expenses/:id/void')
  @RequirePermission('accounting.write')
  voidExpense(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: VoidRecordDto) {
    return this.accountingService.voidExpense(id, user.userId, dto.reason);
  }

  @Get('income-entries')
  listIncome(@Query('branchId') branchId: string) {
    return this.accountingService.listIncome(branchId);
  }

  @Post('income-entries')
  @RequirePermission('accounting.write')
  createIncome(@Body() dto: CreateIncomeDto) {
    return this.accountingService.createIncome(dto);
  }

  @Get('income-entries/:id')
  findIncome(@Param('id') id: string) {
    return this.accountingService.findIncome(id);
  }

  @Patch('income-entries/:id')
  @RequirePermission('accounting.write')
  updateIncome(@Param('id') id: string, @Body() dto: UpdateIncomeDto) {
    return this.accountingService.updateIncome(id, dto);
  }

  @Post('income-entries/:id/void')
  @RequirePermission('accounting.write')
  voidIncome(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: VoidRecordDto) {
    return this.accountingService.voidIncome(id, user.userId, dto.reason);
  }

  @Get('daily-closings')
  listDailyClosings(@Query('branchId') branchId: string) {
    return this.accountingService.listDailyClosings(branchId);
  }

  @Post('daily-closings')
  @RequirePermission('accounting.write')
  createDailyClosing(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDailyClosingDto) {
    return this.accountingService.createDailyClosing(user.userId, dto);
  }

  @Get('daily-closings/:id')
  findDailyClosing(@Param('id') id: string) {
    return this.accountingService.findDailyClosing(id);
  }

  @Patch('daily-closings/:id')
  @RequirePermission('accounting.write')
  updateDailyClosing(@Param('id') id: string, @Body() dto: UpdateDailyClosingDto) {
    return this.accountingService.updateDailyClosing(id, dto);
  }

  @Post('daily-closings/:id/void')
  @RequirePermission('accounting.write')
  voidDailyClosing(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: VoidRecordDto) {
    return this.accountingService.voidDailyClosing(id, user.userId, dto.reason);
  }

  @Get('reports/profit-summary')
  getProfitSummary(
    @Query('branchId') branchId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ): Promise<ProfitSummary> {
    return this.accountingService.getProfitSummary(branchId, new Date(from), new Date(to));
  }
}
