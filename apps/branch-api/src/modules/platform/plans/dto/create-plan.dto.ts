import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePlanDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  userLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  invoiceLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  branchLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceMonthly?: number;
}
