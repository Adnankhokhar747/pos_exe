import { IsArray, IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

const BILL_PAYMENT_METHODS = ['cash', 'debit_card', 'credit_card', 'bank_transfer', 'mobile_wallet', 'online', 'other'] as const;

class BillMedicineLineDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsString()
  description!: string;

  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;
}

class BillPaymentDto {
  @IsIn(BILL_PAYMENT_METHODS)
  method!: (typeof BILL_PAYMENT_METHODS)[number];

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class FinalizeBillDto {
  @IsNumber()
  @Min(0)
  consultationFee!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillMedicineLineDto)
  medicineLines!: BillMedicineLineDto[];

  @IsNumber()
  @Min(0)
  advanceApplied!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillPaymentDto)
  payments!: BillPaymentDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}
