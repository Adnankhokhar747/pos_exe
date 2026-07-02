import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsString, Matches, ValidateNested } from 'class-validator';

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const HHMM_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class DoctorScheduleSlotDto {
  @IsIn(DAYS_OF_WEEK)
  dayOfWeek!: string;

  @IsString()
  @Matches(HHMM_PATTERN, { message: 'startTime must be in HH:mm 24h format' })
  startTime!: string;

  @IsString()
  @Matches(HHMM_PATTERN, { message: 'endTime must be in HH:mm 24h format' })
  endTime!: string;
}

export class UpsertDoctorScheduleDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => DoctorScheduleSlotDto)
  slots!: DoctorScheduleSlotDto[];
}
