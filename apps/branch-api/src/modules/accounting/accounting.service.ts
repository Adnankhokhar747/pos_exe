import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDailyClosingDto, CreateExpenseCategoryDto, CreateExpenseDto, CreateIncomeDto } from './dto/create-expense.dto';
import { UpdateDailyClosingDto, UpdateExpenseDto, UpdateIncomeDto } from './dto/update-expense.dto';
import { RecordAlreadyVoidedError } from '../../common/exceptions/domain-exception';

const ZERO = new Prisma.Decimal(0);

export interface ProfitSummary {
  revenue: string;
  cogs: string;
  grossProfit: string;
  otherIncome: string;
  expenses: string;
  netProfit: string;
}

@Injectable()
export class AccountingService {
  constructor(private readonly prisma: PrismaService) {}

  createExpenseCategory(tenantId: string, dto: CreateExpenseCategoryDto) {
    return this.prisma.expenseCategory.create({ data: { tenantId, name: dto.name } });
  }

  listExpenseCategories(tenantId: string) {
    return this.prisma.expenseCategory.findMany({ where: { tenantId } });
  }

  createExpense(dto: CreateExpenseDto) {
    return this.prisma.expense.create({
      data: {
        branchId: dto.branchId,
        categoryId: dto.categoryId,
        amount: new Prisma.Decimal(dto.amount),
        note: dto.note,
        paidVia: dto.paidVia ?? 'cash',
      },
    });
  }

  listExpenses(branchId: string) {
    return this.prisma.expense.findMany({
      where: { branchId },
      include: { category: true },
      orderBy: { occurredAt: 'desc' },
      take: 200,
    });
  }

  async findExpense(id: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id }, include: { category: true } });
    if (!expense) throw new NotFoundException(`Expense ${id} not found.`);
    return expense;
  }

  async updateExpense(id: string, dto: UpdateExpenseDto) {
    const expense = await this.findExpense(id);
    if (expense.voidedAt) throw new RecordAlreadyVoidedError('expense');
    return this.prisma.expense.update({
      where: { id },
      data: {
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.amount !== undefined ? { amount: new Prisma.Decimal(dto.amount) } : {}),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
        ...(dto.paidVia !== undefined ? { paidVia: dto.paidVia } : {}),
      },
    });
  }

  async voidExpense(id: string, voidedBy: string, reason: string) {
    const expense = await this.findExpense(id);
    if (expense.voidedAt) throw new RecordAlreadyVoidedError('expense');
    return this.prisma.expense.update({
      where: { id },
      data: { voidedAt: new Date(), voidedBy, voidReason: reason },
    });
  }

  createIncome(dto: CreateIncomeDto) {
    return this.prisma.incomeEntry.create({
      data: { branchId: dto.branchId, category: dto.category, amount: new Prisma.Decimal(dto.amount), note: dto.note },
    });
  }

  listIncome(branchId: string) {
    return this.prisma.incomeEntry.findMany({ where: { branchId }, orderBy: { occurredAt: 'desc' }, take: 200 });
  }

  async findIncome(id: string) {
    const income = await this.prisma.incomeEntry.findUnique({ where: { id } });
    if (!income) throw new NotFoundException(`Income entry ${id} not found.`);
    return income;
  }

  async updateIncome(id: string, dto: UpdateIncomeDto) {
    const income = await this.findIncome(id);
    if (income.voidedAt) throw new RecordAlreadyVoidedError('income entry');
    return this.prisma.incomeEntry.update({
      where: { id },
      data: {
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.amount !== undefined ? { amount: new Prisma.Decimal(dto.amount) } : {}),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
      },
    });
  }

  async voidIncome(id: string, voidedBy: string, reason: string) {
    const income = await this.findIncome(id);
    if (income.voidedAt) throw new RecordAlreadyVoidedError('income entry');
    return this.prisma.incomeEntry.update({
      where: { id },
      data: { voidedAt: new Date(), voidedBy, voidReason: reason },
    });
  }

  async createDailyClosing(closedBy: string, dto: CreateDailyClosingDto) {
    const businessDate = new Date(dto.businessDate);
    const dayStart = new Date(businessDate);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const cashSales = await this.prisma.payment.aggregate({
      where: { method: 'cash', invoice: { branchId: dto.branchId, status: 'completed', createdAt: { gte: dayStart, lt: dayEnd } } },
      _sum: { amount: true },
    });
    const expectedCash = cashSales._sum.amount ?? ZERO;
    const countedCash = new Prisma.Decimal(dto.countedCash);

    return this.prisma.dailyClosing.create({
      data: {
        branchId: dto.branchId,
        businessDate: dayStart,
        expectedCash,
        countedCash,
        variance: countedCash.sub(expectedCash),
        closedBy,
      },
    });
  }

  listDailyClosings(branchId: string) {
    return this.prisma.dailyClosing.findMany({ where: { branchId }, orderBy: { businessDate: 'desc' }, take: 90 });
  }

  async findDailyClosing(id: string) {
    const closing = await this.prisma.dailyClosing.findUnique({ where: { id } });
    if (!closing) throw new NotFoundException(`Daily closing ${id} not found.`);
    return closing;
  }

  async updateDailyClosing(id: string, dto: UpdateDailyClosingDto) {
    const closing = await this.findDailyClosing(id);
    if (closing.voidedAt) throw new RecordAlreadyVoidedError('daily closing');
    const countedCash = new Prisma.Decimal(dto.countedCash);
    return this.prisma.dailyClosing.update({
      where: { id },
      data: { countedCash, variance: countedCash.sub(closing.expectedCash) },
    });
  }

  async voidDailyClosing(id: string, voidedBy: string, reason: string) {
    const closing = await this.findDailyClosing(id);
    if (closing.voidedAt) throw new RecordAlreadyVoidedError('daily closing');
    return this.prisma.dailyClosing.update({
      where: { id },
      data: { voidedAt: new Date(), voidedBy, voidReason: reason },
    });
  }

  async getProfitSummary(branchId: string, from: Date, to: Date): Promise<ProfitSummary> {
    const invoices = await this.prisma.invoice.findMany({
      where: { branchId, status: 'completed', createdAt: { gte: from, lte: to } },
      select: { invoiceType: true, grandTotal: true },
    });
    const revenue = invoices.reduce(
      (sum, invoice) => sum.add(invoice.invoiceType === 'sale' ? invoice.grandTotal : invoice.grandTotal.neg()),
      ZERO,
    );

    const saleMovements = await this.prisma.stockLedgerEntry.findMany({
      where: { movementType: { in: ['sale', 'sale_return'] }, warehouse: { branchId }, occurredAt: { gte: from, lte: to } },
      select: { quantityDelta: true, unitCostAtMove: true },
    });
    const cogs = saleMovements.reduce((sum, movement) => sum.add(movement.quantityDelta.neg().mul(movement.unitCostAtMove)), ZERO);

    const expenseAgg = await this.prisma.expense.aggregate({
      where: { branchId, occurredAt: { gte: from, lte: to }, voidedAt: null },
      _sum: { amount: true },
    });
    const incomeAgg = await this.prisma.incomeEntry.aggregate({
      where: { branchId, occurredAt: { gte: from, lte: to }, voidedAt: null },
      _sum: { amount: true },
    });

    const grossProfit = revenue.sub(cogs);
    const expenses = expenseAgg._sum.amount ?? ZERO;
    const otherIncome = incomeAgg._sum.amount ?? ZERO;
    const netProfit = grossProfit.add(otherIncome).sub(expenses);

    return {
      revenue: revenue.toString(),
      cogs: cogs.toString(),
      grossProfit: grossProfit.toString(),
      otherIncome: otherIncome.toString(),
      expenses: expenses.toString(),
      netProfit: netProfit.toString(),
    };
  }
}
