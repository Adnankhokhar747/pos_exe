import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  userLimit?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  invoiceLimit?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  branchLimit?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceMonthly?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
