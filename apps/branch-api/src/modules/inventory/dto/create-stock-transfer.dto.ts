import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumberString, IsString, ValidateNested } from 'class-validator';

export class StockTransferLineDto {
  @IsString()
  productId!: string;

  @IsNumberString()
  quantity!: string;
}

export class CreateStockTransferDto {
  @IsString()
  fromWarehouseId!: string;

  @IsString()
  toWarehouseId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StockTransferLineDto)
  lines!: StockTransferLineDto[];
}
