import { IsNumberString, IsOptional, IsString } from 'class-validator';

export class CreateExpenseCategoryDto {
  @IsString()
  name!: string;
}

export class CreateExpenseDto {
  @IsString()
  branchId!: string;

  @IsString()
  categoryId!: string;

  @IsNumberString()
  amount!: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  paidVia?: string;
}

export class CreateIncomeDto {
  @IsString()
  branchId!: string;

  @IsString()
  category!: string;

  @IsNumberString()
  amount!: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateDailyClosingDto {
  @IsString()
  branchId!: string;

  @IsString()
  businessDate!: string;

  @IsNumberString()
  countedCash!: string;
}
