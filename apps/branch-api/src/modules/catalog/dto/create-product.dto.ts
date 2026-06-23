import { IsBoolean, IsNumberString, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateProductDto {
  @IsString()
  sku!: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsNumberString()
  costPrice!: string;

  @IsNumberString()
  salePrice!: string;

  @IsOptional()
  @IsNumberString()
  taxRatePct?: string;

  @IsOptional()
  @IsString()
  taxTemplateId?: string;

  @IsOptional()
  @IsString()
  parentProductId?: string;

  @IsOptional()
  @IsObject()
  variantAttributes?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  isBundle?: boolean;

  @IsOptional()
  @IsBoolean()
  trackBatches?: boolean;

  @IsOptional()
  @IsBoolean()
  trackSerials?: boolean;
}
