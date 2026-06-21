import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsNumberString, IsOptional, IsString, ValidateNested } from 'class-validator';

export class ReturnLineDto {
  @IsString()
  invoiceLineId!: string;

  @IsNumberString()
  quantity!: string;
}

export class CreateReturnDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnLineDto)
  lines!: ReturnLineDto[];

  @IsOptional()
  @IsIn(['cash', 'debit_card', 'credit_card', 'bank_transfer', 'mobile_wallet', 'store_credit'])
  refundMethod?: string;
}
