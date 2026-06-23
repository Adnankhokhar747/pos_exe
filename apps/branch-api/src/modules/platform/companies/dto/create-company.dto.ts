import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  companyName!: string;

  @IsOptional()
  @IsString()
  baseCurrency?: string;

  @IsString()
  planId!: string;

  @IsString()
  adminFullName!: string;

  @IsString()
  adminUsername!: string;

  @IsOptional()
  @IsEmail()
  adminEmail?: string;

  @MinLength(8)
  adminPassword!: string;
}
