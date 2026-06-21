import { Injectable } from '@nestjs/common';
import { CashDrawerSession, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CashDrawerSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  open(branchId: string, openedBy: string, openingFloat: string): Promise<CashDrawerSession> {
    return this.prisma.cashDrawerSession.create({
      data: { branchId, openedBy, openingFloat: new Prisma.Decimal(openingFloat) },
    });
  }

  getCurrent(branchId: string): Promise<CashDrawerSession | null> {
    return this.prisma.cashDrawerSession.findFirst({
      where: { branchId, closedAt: null },
      orderBy: { openedAt: 'desc' },
    });
  }

  // Expected cash = opening float + every cash payment recorded on a completed
  // sale since the drawer opened, for this branch — docs/00-functional-specification.md §20.
  async close(id: string, closedBy: string, closingCount: string): Promise<CashDrawerSession> {
    const session = await this.prisma.cashDrawerSession.findUniqueOrThrow({ where: { id } });

    const cashPayments = await this.prisma.payment.aggregate({
      where: {
        method: 'cash',
        invoice: { branchId: session.branchId, status: 'completed', createdAt: { gte: session.openedAt } },
      },
      _sum: { amount: true },
    });

    const expectedClose = session.openingFloat.add(cashPayments._sum.amount ?? new Prisma.Decimal(0));
    const counted = new Prisma.Decimal(closingCount);

    return this.prisma.cashDrawerSession.update({
      where: { id },
      data: {
        closedBy,
        closedAt: new Date(),
        expectedClose,
        closingCount: counted,
        variance: counted.sub(expectedClose),
      },
    });
  }

  list(branchId: string) {
    return this.prisma.cashDrawerSession.findMany({
      where: { branchId },
      orderBy: { openedAt: 'desc' },
      take: 50,
    });
  }
}
