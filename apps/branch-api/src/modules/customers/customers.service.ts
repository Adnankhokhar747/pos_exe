import { Injectable } from '@nestjs/common';
import { Customer, CustomerLedgerEntryType, Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';

type Tx = Prisma.TransactionClient | PrismaClient;

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

  list(tenantId: string, search?: string): Promise<Customer[]> {
    return this.prisma.customer.findMany({
      where: {
        tenantId,
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
}
