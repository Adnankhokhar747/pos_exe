import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateCurrencyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  symbol?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  decimalPlaces?: number;
}
