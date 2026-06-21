import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumberString, IsOptional, IsString, ValidateNested } from 'class-validator';

export class StockAdjustmentLineDto {
  @IsString()
  productId!: string;

  @IsNumberString()
  countedQuantity!: string;
}

export class CreateStockAdjustmentDto {
  @IsString()
  warehouseId!: string;

  @IsString()
  reasonCode!: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StockAdjustmentLineDto)
  lines!: StockAdjustmentLineDto[];
}
