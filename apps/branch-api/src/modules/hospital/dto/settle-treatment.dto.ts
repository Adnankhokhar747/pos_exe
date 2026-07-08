import { IsIn } from 'class-validator';

const SETTLEMENT_METHODS = ['cash', 'debit_card', 'credit_card', 'bank_transfer', 'mobile_wallet', 'other'] as const;

export class SettleTreatmentDto {
  @IsIn(SETTLEMENT_METHODS)
  method!: (typeof SETTLEMENT_METHODS)[number];
}
