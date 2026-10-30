import { IsBoolean, IsInt, IsString } from 'class-validator';

/** An appointment type the calendar offers; durations in minutes. */
export class CalendarDayAppointmentTypeDto {
  @IsString()
  declare id: string;

  @IsString()
  declare name: string;

  @IsInt()
  declare duration: number;

  @IsInt()
  declare grid: number;

  @IsInt()
  declare buffer: number;

  @IsBoolean()
  declare needsConfirmation: boolean;
}
