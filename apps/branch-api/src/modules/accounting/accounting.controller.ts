import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AccountingService, ProfitSummary } from './accounting.service';
import {
  CreateDailyClosingDto,
  CreateExpenseCategoryDto,
  CreateExpenseDto,
  CreateIncomeDto,
} from './dto/create-expense.dto';
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

  @Get('income-entries')
  listIncome(@Query('branchId') branchId: string) {
    return this.accountingService.listIncome(branchId);
  }

  @Post('income-entries')
  @RequirePermission('accounting.write')
  createIncome(@Body() dto: CreateIncomeDto) {
    return this.accountingService.createIncome(dto);
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

  @Get('reports/profit-summary')
  getProfitSummary(
    @Query('branchId') branchId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ): Promise<ProfitSummary> {
    return this.accountingService.getProfitSummary(branchId, new Date(from), new Date(to));
  }
}
