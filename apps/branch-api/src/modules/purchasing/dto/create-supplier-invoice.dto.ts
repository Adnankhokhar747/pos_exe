import { IsDateString, IsNumberString, IsOptional, IsString } from 'class-validator';

export class CreateSupplierInvoiceDto {
  @IsString()
  supplierId!: string;

  @IsOptional()
  @IsString()
  goodsReceiptId?: string;

  @IsString()
  invoiceNo!: string;

  @IsNumberString()
  amount!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
