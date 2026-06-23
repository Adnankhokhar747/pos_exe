import { Injectable } from '@nestjs/common';
import { Coupon, Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertCouponDto } from './dto/upsert-coupon.dto';
import { InvalidCouponError } from '../../common/exceptions/domain-exception';

type Tx = Prisma.TransactionClient | PrismaClient;

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string): Promise<Coupon[]> {
    return this.prisma.coupon.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
  }

  create(tenantId: string, dto: UpsertCouponDto): Promise<Coupon> {
    return this.prisma.coupon.create({
      data: {
        tenantId,
        code: dto.code.toUpperCase(),
        discountType: dto.discountType,
        discountValue: new Prisma.Decimal(dto.discountValue),
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        usageLimit: dto.usageLimit,
        isActive: dto.isActive ?? true,
      },
    });
  }

  // Validates a coupon against a subtotal and returns the discount it would apply,
  // without mutating usageCount — callers that go on to actually use it must call
  // consume() within the same transaction as the sale.
  async validate(tenantId: string, code: string, subtotal: Prisma.Decimal): Promise<{ coupon: Coupon; discount: Prisma.Decimal }> {
    const coupon = await this.prisma.coupon.findUnique({ where: { tenantId_code: { tenantId, code: code.toUpperCase() } } });
    if (!coupon) throw new InvalidCouponError(code, 'not found');
    if (!coupon.isActive) throw new InvalidCouponError(code, 'inactive');
    if (coupon.expiryDate && coupon.expiryDate < new Date()) throw new InvalidCouponError(code, 'expired');
    if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
      throw new InvalidCouponError(code, 'usage limit reached');
    }

    const discount =
      coupon.discountType === 'percentage'
        ? subtotal.mul(coupon.discountValue).div(100)
        : Prisma.Decimal.min(coupon.discountValue, subtotal);

    return { coupon, discount };
  }

  async consume(tx: Tx, couponId: string): Promise<void> {
    await tx.coupon.update({ where: { id: couponId }, data: { usageCount: { increment: 1 } } });
  }
}
