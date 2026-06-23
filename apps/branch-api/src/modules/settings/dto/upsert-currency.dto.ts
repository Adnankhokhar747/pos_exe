import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpsertCurrencyDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsString()
  symbol!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  decimalPlaces?: number;
}
