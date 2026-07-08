import { IsArray, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class DraftMedicineLineDto {
  @IsOptional() @IsString() productId?: string;
  @IsString() description!: string;
  @IsNumber() @Min(0.01) quantity!: number;
  @IsNumber() @Min(0) unitPrice!: number;
}

export class SaveDraftBillDto {
  @IsNumber() @Min(0) consultationFee!: number;

  @IsArray() @ValidateNested({ each: true }) @Type(() => DraftMedicineLineDto)
  medicineLines!: DraftMedicineLineDto[];

  @IsOptional() @IsString() notes?: string;
}
