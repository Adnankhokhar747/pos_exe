import { ArrayMinSize, IsArray, IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

const ADVANCE_PAYMENT_METHODS = ['cash', 'debit_card', 'credit_card', 'bank_transfer', 'mobile_wallet', 'other'] as const;

class AdvancePaymentLine {
  @IsIn(ADVANCE_PAYMENT_METHODS)
  method!: (typeof ADVANCE_PAYMENT_METHODS)[number];

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class RecordAdvanceDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AdvancePaymentLine)
  payments!: AdvancePaymentLine[];

  @IsOptional()
  @IsString()
  notes?: string;
}
