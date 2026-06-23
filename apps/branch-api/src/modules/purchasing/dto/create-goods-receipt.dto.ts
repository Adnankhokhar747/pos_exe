import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsISO8601, IsNumberString, IsOptional, IsString, ValidateNested } from 'class-validator';

export class GoodsReceiptLineDto {
  @IsString()
  productId!: string;

  @IsNumberString()
  quantityReceived!: string;

  @IsNumberString()
  unitCost!: string;

  @IsOptional()
  @IsString()
  batchNo?: string;

  @IsOptional()
  @IsISO8601()
  expiryDate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serialNumbers?: string[];
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
