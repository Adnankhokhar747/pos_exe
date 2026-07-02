import { IsDateString, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateAppointmentDto {
  @IsUUID()
  patientId!: string;

  @IsUUID()
  doctorId!: string;

  @IsIn(['walk_in', 'advance'])
  appointmentType!: 'walk_in' | 'advance';

  // Required for advance bookings (the future date being booked); ignored for walk_in,
  // which is always issued for today.
  @IsOptional()
  @IsDateString()
  appointmentDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
