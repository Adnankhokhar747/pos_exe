import { IsBoolean, IsNumberString, IsOptional, IsString } from 'class-validator';

// Bundle/variant topology (isBundle, parentProductId) is owned by product creation
// and the dedicated setBundleComponents endpoint, not retrofittable via a generic
// PATCH without touching BundleComponent rows — deliberately excluded here.
export class UpdateProductDto {
  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsNumberString()
  costPrice?: string;

  @IsOptional()
  @IsNumberString()
  salePrice?: string;

  @IsOptional()
  @IsNumberString()
  taxRatePct?: string;

  @IsOptional()
  @IsString()
  taxTemplateId?: string;

  @IsOptional()
  @IsBoolean()
  trackBatches?: boolean;

  @IsOptional()
  @IsBoolean()
  trackSerials?: boolean;
}
