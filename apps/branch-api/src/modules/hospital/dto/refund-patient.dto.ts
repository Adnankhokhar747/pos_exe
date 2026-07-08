import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

const REFUND_METHODS = ['cash', 'debit_card', 'credit_card', 'bank_transfer', 'mobile_wallet', 'other'] as const;

export class RefundPatientDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsIn(REFUND_METHODS)
  method!: (typeof REFUND_METHODS)[number];

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
