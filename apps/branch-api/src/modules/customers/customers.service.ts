import { Injectable, NotFoundException } from '@nestjs/common';
import { Customer, CustomerLedgerEntryType, LoyaltyTransactionType, Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { InsufficientLoyaltyPointsError } from '../../common/exceptions/domain-exception';

type Tx = Prisma.TransactionClient | PrismaClient;

// 1 loyalty point earned per whole currency unit spent; 100 points redeemable for 1
// currency unit of discount. A flat, documented ratio — tenant-configurable loyalty
// tiers are out of scope for this slice.
export const LOYALTY_EARN_RATE = new Prisma.Decimal('1');
export const LOYALTY_REDEMPTION_VALUE = new Prisma.Decimal('0.01');

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  create(tenantId: string, dto: CreateCustomerDto): Promise<Customer> {
    return this.prisma.customer.create({
      data: {
        tenantId,
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        taxNumber: dto.taxNumber,
        creditLimit: dto.creditLimit ? new Prisma.Decimal(dto.creditLimit) : undefined,
      },
    });
  }

  list(tenantId: string, search?: string, includeInactive = false): Promise<Customer[]> {
    return this.prisma.customer.findMany({
      where: {
        tenantId,
        ...(includeInactive ? {} : { isActive: true }),
        ...(search
          ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }] }
          : {}),
      },
      orderBy: { name: 'asc' },
      take: 200,
    });
  }

  findOne(tenantId: string, id: string): Promise<Customer | null> {
    return this.prisma.customer.findFirst({ where: { id, tenantId } });
  }

  // Same tenant-scoping gap found across products/suppliers services: tenantId was
  // accepted but never applied to the query. updateMany() + a count check closes it.
  async update(tenantId: string, id: string, dto: UpdateCustomerDto): Promise<Customer> {
    const { count } = await this.prisma.customer.updateMany({
      where: { id, tenantId },
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        taxNumber: dto.taxNumber,
        creditLimit: dto.creditLimit ? new Prisma.Decimal(dto.creditLimit) : undefined,
        isActive: dto.isActive,
      },
    });
    if (count === 0) throw new NotFoundException(`Customer ${id} not found.`);
    return this.prisma.customer.findUniqueOrThrow({ where: { id } });
  }

  async deactivate(tenantId: string, id: string): Promise<Customer> {
    const { count } = await this.prisma.customer.updateMany({ where: { id, tenantId }, data: { isActive: false } });
    if (count === 0) throw new NotFoundException(`Customer ${id} not found.`);
    return this.prisma.customer.findUniqueOrThrow({ where: { id } });
  }

  getLedger(customerId: string) {
    return this.prisma.customerLedgerEntry.findMany({
      where: { customerId },
      orderBy: { occurredAt: 'desc' },
    });
  }

  // Shared by Sales (credit sales / returns) and the payment-recording endpoint below.
  // Always runs within the caller's transaction so a ledger entry and the balance update
  // it reflects can never diverge (docs/00-functional-specification.md §14).
  async recordLedgerEntry(
    tx: Tx,
    customerId: string,
    entryType: CustomerLedgerEntryType,
    amount: Prisma.Decimal,
    referenceTable?: string,
    referenceId?: string,
  ): Promise<void> {
    const customer = await tx.customer.update({
      where: { id: customerId },
      data: { currentBalance: { increment: amount } },
    });

    await tx.customerLedgerEntry.create({
      data: {
        customerId,
        entryType,
        amount,
        balanceAfter: customer.currentBalance,
        referenceTable,
        referenceId,
      },
    });
  }

  async recordPayment(tenantId: string, customerId: string, amount: string): Promise<Customer> {
    return this.prisma.$transaction(async (tx) => {
      const decimalAmount = new Prisma.Decimal(amount).neg();
      await this.recordLedgerEntry(tx, customerId, 'payment', decimalAmount);
      return tx.customer.findFirstOrThrow({ where: { id: customerId, tenantId } });
    });
  }

  getLoyaltyTransactions(customerId: string) {
    return this.prisma.loyaltyTransaction.findMany({
      where: { customerId },
      orderBy: { occurredAt: 'desc' },
    });
  }

  // Mirrors recordLedgerEntry: runs in the caller's transaction so the points balance
  // and its ledger row can never diverge.
  async recordLoyaltyEntry(
    tx: Tx,
    customerId: string,
    type: LoyaltyTransactionType,
    points: Prisma.Decimal,
    referenceTable?: string,
    referenceId?: string,
  ): Promise<void> {
    const customer = await tx.customer.update({
      where: { id: customerId },
      data: { loyaltyPoints: { increment: points } },
    });

    await tx.loyaltyTransaction.create({
      data: { customerId, type, points, balanceAfter: customer.loyaltyPoints, referenceTable, referenceId },
    });
  }

  // Earning is computed off grandTotal *before* any points redemption is netted in,
  // so a customer can't reduce their own future earn rate by redeeming on the same sale.
  earnedPointsFor(grandTotal: Prisma.Decimal): Prisma.Decimal {
    return grandTotal.mul(LOYALTY_EARN_RATE).floor();
  }

  redemptionDiscountFor(points: Prisma.Decimal): Prisma.Decimal {
    return points.mul(LOYALTY_REDEMPTION_VALUE);
  }

  async assertSufficientPoints(tenantId: string, customerId: string, points: Prisma.Decimal): Promise<void> {
    const customer = await this.prisma.customer.findFirstOrThrow({ where: { id: customerId, tenantId } });
    if (customer.loyaltyPoints.lessThan(points)) {
      throw new InsufficientLoyaltyPointsError(customer.loyaltyPoints.toString(), points.toString());
    }
  }
}
