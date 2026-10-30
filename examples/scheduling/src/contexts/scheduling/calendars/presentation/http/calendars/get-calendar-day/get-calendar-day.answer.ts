import { Type } from 'class-transformer';
import { IsArray, IsString, ValidateNested } from 'class-validator';
import { CalendarDayAppointmentTypeDto } from '@/contexts/scheduling/presentation/http/shared/calendar-day-appointment-type.dto';
import { CalendarDayBusyDto } from '@/contexts/scheduling/presentation/http/shared/calendar-day-busy.dto';
import { CalendarDaySpanDto } from '@/contexts/scheduling/presentation/http/shared/calendar-day-span.dto';

export class GetCalendarDayAnswer {
  @IsString()
  declare calendarId: string;

  /** `YYYY-MM-DD` in the time zone below. */
  @IsString()
  declare day: string;

  @IsString()
  declare timeZone: string;

  /** The opening ranges of the day. */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CalendarDaySpanDto)
  declare open: CalendarDaySpanDto[];

  /** The time off that crosses the day. */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CalendarDaySpanDto)
  declare timeOff: CalendarDaySpanDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CalendarDayAppointmentTypeDto)
  declare appointmentTypes: CalendarDayAppointmentTypeDto[];

  /** What is held, by start. */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CalendarDayBusyDto)
  declare busy: CalendarDayBusyDto[];
}
