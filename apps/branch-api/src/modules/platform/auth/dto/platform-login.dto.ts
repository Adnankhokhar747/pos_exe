import { IsString, MinLength } from 'class-validator';

export class PlatformLoginDto {
  @IsString()
  username!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
