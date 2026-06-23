import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateReceiptSettingsDto {
  @IsOptional()
  @IsString()
  headerText?: string;

  @IsOptional()
  @IsString()
  footerText?: string;

  @IsOptional()
  @IsInt()
  @Min(40)
  @Max(216)
  paperWidthMm?: number;
}
