import { IsEmail, IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateDoctorDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  specialization?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  roomNumber?: string;

  @IsOptional()
  @IsNumberString()
  consultationFee?: string;

  @IsOptional()
  @IsUUID()
  linkedUserId?: string;
}
