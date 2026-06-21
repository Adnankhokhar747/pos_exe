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
}

export class InvoicePaymentDto {
  @IsIn(['cash', 'debit_card', 'credit_card', 'bank_transfer', 'mobile_wallet', 'credit_sale'])
  method!: 'cash' | 'debit_card' | 'credit_card' | 'bank_transfer' | 'mobile_wallet' | 'credit_sale';

  @IsNumberString()
  amount!: string;

  @IsOptional()
  @IsNumberString()
  receivedAmount?: string;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class CreateInvoiceDto {
  @IsString()
  branchId!: string;

  @IsString()
  warehouseId!: string;

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
}
