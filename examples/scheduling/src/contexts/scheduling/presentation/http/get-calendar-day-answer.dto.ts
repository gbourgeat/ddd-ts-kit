import { Type } from 'class-transformer';
import { IsArray, IsString, ValidateNested } from 'class-validator';
import { CalendarDayAppointmentTypeDto } from './calendar-day-appointment-type.dto.js';
import { CalendarDayBusyDto } from './calendar-day-busy.dto.js';
import { CalendarDaySpanDto } from './calendar-day-span.dto.js';

export class GetCalendarDayAnswer {
  @IsString()
  calendarId = '';

  /** `YYYY-MM-DD` in the time zone below. */
  @IsString()
  day = '';

  @IsString()
  timeZone = '';

  /** The opening ranges of the day. */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CalendarDaySpanDto)
  open: CalendarDaySpanDto[] = [];

  /** The time off that crosses the day. */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CalendarDaySpanDto)
  timeOff: CalendarDaySpanDto[] = [];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CalendarDayAppointmentTypeDto)
  appointmentTypes: CalendarDayAppointmentTypeDto[] = [];

  /** What is held, by start. */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CalendarDayBusyDto)
  busy: CalendarDayBusyDto[] = [];
}
