import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateAppointmentStatusDto {
  @IsIn(['confirmed', 'completed', 'cancelled', 'no_show'])
  status!: 'confirmed' | 'completed' | 'cancelled' | 'no_show';

  @IsOptional()
  @IsString()
  cancelReason?: string;
}
