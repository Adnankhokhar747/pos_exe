import { IsArray, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class PaymentLineDto {
  @IsString()
  method!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class CreateAppointmentPaymentDto {
  @IsNumber()
  @Min(0)
  totalDue!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentLineDto)
  lines!: PaymentLineDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}
