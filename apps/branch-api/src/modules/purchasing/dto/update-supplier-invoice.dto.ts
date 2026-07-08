import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class UpdateSupplierInvoiceDto {
  @IsOptional()
  @IsString()
  invoiceNo?: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;
}
