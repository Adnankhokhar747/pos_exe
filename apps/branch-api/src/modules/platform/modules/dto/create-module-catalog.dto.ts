import { IsOptional, IsString } from 'class-validator';

export class CreateModuleCatalogDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
