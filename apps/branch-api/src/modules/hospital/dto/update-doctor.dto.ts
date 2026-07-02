import { IsBoolean, IsEmail, IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateDoctorDto {
  @IsOptional()
  @IsString()
  name?: string;

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
  linkedUserId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
