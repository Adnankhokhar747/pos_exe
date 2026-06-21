import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumberString, IsOptional, IsString, ValidateNested } from 'class-validator';

export class GoodsReceiptLineDto {
  @IsString()
  productId!: string;

  @IsNumberString()
  quantityReceived!: string;

  @IsNumberString()
  unitCost!: string;
}

export class CreateGoodsReceiptDto {
  @IsOptional()
  @IsString()
  purchaseOrderId?: string;

  @IsString()
  warehouseId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GoodsReceiptLineDto)
  lines!: GoodsReceiptLineDto[];
}
