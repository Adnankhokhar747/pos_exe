import { IsBoolean, IsIn, IsNumberString, IsOptional, IsString } from 'class-validator';

const TAX_TYPES = ['vat', 'gst', 'sales_tax', 'custom'] as const;

export class UpsertTaxTemplateDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsIn(TAX_TYPES)
  taxType?: (typeof TAX_TYPES)[number];

  @IsNumberString()
  ratePct!: string;

  @IsOptional()
  @IsBoolean()
  isInclusive?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
