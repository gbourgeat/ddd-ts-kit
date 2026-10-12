import { IsBoolean, IsInt, IsString } from 'class-validator';

/** An appointment type the calendar offers; durations in minutes. */
export class CalendarDayAppointmentTypeDto {
  @IsString()
  id = '';

  @IsString()
  name = '';

  @IsInt()
  duration = 0;

  @IsInt()
  grid = 0;

  @IsInt()
  buffer = 0;

  @IsBoolean()
  needsConfirmation = false;
}
