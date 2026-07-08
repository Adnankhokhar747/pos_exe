import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { PurchaseOrderLineDto } from './create-purchase-order.dto';

export class UpdatePurchaseOrderDto {
  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderLineDto)
  lines?: PurchaseOrderLineDto[];
}
