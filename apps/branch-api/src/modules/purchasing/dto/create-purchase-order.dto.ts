import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumberString, IsString, ValidateNested } from 'class-validator';

export class PurchaseOrderLineDto {
  @IsString()
  productId!: string;

  @IsNumberString()
  quantityOrdered!: string;

  @IsNumberString()
  unitCost!: string;
}

export class CreatePurchaseOrderDto {
  @IsString()
  supplierId!: string;

  @IsString()
  warehouseId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderLineDto)
  lines!: PurchaseOrderLineDto[];
}
