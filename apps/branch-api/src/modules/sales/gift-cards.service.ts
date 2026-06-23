import { randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { GiftCard, Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IssueGiftCardDto } from './dto/issue-gift-card.dto';
import { InvalidGiftCardError } from '../../common/exceptions/domain-exception';

type Tx = Prisma.TransactionClient | PrismaClient;

@Injectable()
export class GiftCardsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string): Promise<GiftCard[]> {
    return this.prisma.giftCard.findMany({ where: { tenantId }, orderBy: { issuedAt: 'desc' } });
  }

  async issue(tenantId: string, dto: IssueGiftCardDto): Promise<GiftCard> {
    const code = (dto.code ?? randomBytes(5).toString('hex').toUpperCase());
    const initialBalance = new Prisma.Decimal(dto.initialBalance);

    return this.prisma.$transaction(async (tx) => {
      const giftCard = await tx.giftCard.create({
        data: {
          tenantId,
          code,
          initialBalance,
          currentBalance: initialBalance,
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        },
      });

      await tx.giftCardTransaction.create({
        data: { giftCardId: giftCard.id, type: 'issue', amount: initialBalance, balanceAfter: initialBalance },
      });

      return giftCard;
    });
  }

  async findByCode(tenantId: string, code: string): Promise<GiftCard | null> {
    return this.prisma.giftCard.findUnique({ where: { tenantId_code: { tenantId, code: code.toUpperCase() } } });
  }

  async getBalance(tenantId: string, code: string): Promise<{ code: string; currentBalance: string; isActive: boolean }> {
    const giftCard = await this.findByCode(tenantId, code);
    if (!giftCard) throw new InvalidGiftCardError(code, 'not found');
    return { code: giftCard.code, currentBalance: giftCard.currentBalance.toString(), isActive: giftCard.isActive };
  }

  async reload(tenantId: string, code: string, amount: string): Promise<GiftCard> {
    const giftCard = await this.findByCode(tenantId, code);
    if (!giftCard) throw new InvalidGiftCardError(code, 'not found');
    const reloadAmount = new Prisma.Decimal(amount);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.giftCard.update({
        where: { id: giftCard.id },
        data: { currentBalance: { increment: reloadAmount } },
      });
      await tx.giftCardTransaction.create({
        data: { giftCardId: giftCard.id, type: 'reload', amount: reloadAmount, balanceAfter: updated.currentBalance },
      });
      return updated;
    });
  }

  // Validates and redeems within the caller's transaction (invoice creation) so a
  // gift card can never be debited without the sale that authorized it actually committing.
  async redeem(tx: Tx, tenantId: string, code: string, amount: Prisma.Decimal): Promise<GiftCard> {
    const giftCard = await tx.giftCard.findUnique({ where: { tenantId_code: { tenantId, code: code.toUpperCase() } } });
    if (!giftCard) throw new InvalidGiftCardError(code, 'not found');
    if (!giftCard.isActive) throw new InvalidGiftCardError(code, 'inactive');
    if (giftCard.expiryDate && giftCard.expiryDate < new Date()) throw new InvalidGiftCardError(code, 'expired');
    if (giftCard.currentBalance.lessThan(amount)) throw new InvalidGiftCardError(code, 'insufficient balance');

    const updated = await tx.giftCard.update({
      where: { id: giftCard.id },
      data: { currentBalance: { decrement: amount } },
    });
    await tx.giftCardTransaction.create({
      data: { giftCardId: giftCard.id, type: 'redeem', amount: amount.neg(), balanceAfter: updated.currentBalance },
    });
    return updated;
  }
}
