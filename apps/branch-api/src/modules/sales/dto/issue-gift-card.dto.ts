import { IsISO8601, IsNumberString, IsOptional, IsString } from 'class-validator';

export class IssueGiftCardDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsNumberString()
  initialBalance!: string;

  @IsOptional()
  @IsISO8601()
  expiryDate?: string;
}
