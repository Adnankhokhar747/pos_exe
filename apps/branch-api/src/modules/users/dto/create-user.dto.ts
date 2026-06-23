import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  fullName!: string;

  @IsString()
  username!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @MinLength(8)
  password!: string;

  @IsString()
  roleId!: string;
}
