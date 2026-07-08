import { IsOptional, IsString } from 'class-validator';

export class UpdateSupplierPaymentDto {
  @IsOptional()
  @IsString()
  method?: string;
}
