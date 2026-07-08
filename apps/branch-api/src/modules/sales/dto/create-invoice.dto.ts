import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class InvoiceLineDto {
  @IsString()
  productId!: string;

  @IsNumberString()
  quantity!: string;

  @IsNumberString()
  unitPrice!: string;

  @IsOptional()
  @IsNumberString()
  discountValue?: string;

  // Required when the product has trackSerials enabled — one serial per unit sold.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serialNumbers?: string[];
}

const PAYMENT_METHODS = [
  'cash',
  'debit_card',
  'credit_card',
  'bank_transfer',
  'mobile_wallet',
  'credit_sale',
  'store_credit',
  'gift_card',
  'patient_advance',
] as const;

export class InvoicePaymentDto {
  @IsIn(PAYMENT_METHODS)
  method!: (typeof PAYMENT_METHODS)[number];

  @IsNumberString()
  amount!: string;

  @IsOptional()
  @IsNumberString()
  receivedAmount?: string;

  // For method 'gift_card', this is the redeemed gift card's code.
  @IsOptional()
  @IsString()
  reference?: string;
}

export class CreateInvoiceDto {
  @IsString()
  branchId!: string;

  @IsString()
  warehouseId!: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  patientId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines!: InvoiceLineDto[];

  @IsOptional()
  @IsNumberString()
  invoiceDiscountValue?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoicePaymentDto)
  payments!: InvoicePaymentDto[];

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsNumberString()
  loyaltyPointsToRedeem?: string;

  @IsOptional()
  @IsString()
  currencyCode?: string;
}
