import { IsNumberString, IsOptional, IsString } from 'class-validator';

export class UpdateExpenseDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsNumberString()
  amount?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  paidVia?: string;
}

export class UpdateIncomeDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumberString()
  amount?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateDailyClosingDto {
  @IsNumberString()
  countedCash!: string;
}

export class VoidRecordDto {
  @IsString()
  reason!: string;
}
