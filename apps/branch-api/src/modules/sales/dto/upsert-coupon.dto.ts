import { IsBoolean, IsIn, IsISO8601, IsInt, IsNumberString, IsOptional, IsString, Min } from 'class-validator';

const DISCOUNT_TYPES = ['percentage', 'fixed'] as const;

export class UpsertCouponDto {
  @IsString()
  code!: string;

  @IsIn(DISCOUNT_TYPES)
  discountType!: (typeof DISCOUNT_TYPES)[number];

  @IsNumberString()
  discountValue!: string;

  @IsOptional()
  @IsISO8601()
  expiryDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
