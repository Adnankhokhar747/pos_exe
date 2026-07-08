import { IsBoolean, IsISO8601, IsOptional } from 'class-validator';

export class UpdateGiftCardDto {
  @IsOptional()
  @IsISO8601()
  expiryDate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
