import { Type } from 'class-transformer';
import { IsArray, IsNumberString, IsOptional, IsString, ValidateNested } from 'class-validator';

export class SupplierPaymentAllocationDto {
  @IsString()
  supplierInvoiceId!: string;

  @IsNumberString()
  amount!: string;
}

export class CreateSupplierPaymentDto {
  @IsString()
  supplierId!: string;

  @IsNumberString()
  amount!: string;

  @IsOptional()
  @IsString()
  method?: string;

  // If omitted, allocates FIFO against the supplier's oldest unpaid invoices
  // (docs/00-functional-specification.md §14).
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupplierPaymentAllocationDto)
  allocations?: SupplierPaymentAllocationDto[];
}
