import { Type } from 'class-transformer';
import { IsISO8601, IsOptional, ValidateNested } from 'class-validator';
import { CalendarDayAppointmentDto } from '@/contexts/scheduling/presentation/http/shared/calendar-day-appointment.dto';

/** A held slot: busy, and whose appointment it is only when the asker may read it. */
export class CalendarDayBusyDto {
  @IsISO8601()
  declare startsAt: string;

  @IsISO8601()
  declare endsAt: string;

  /** The end of what is held, the buffer after the appointment included. */
  @IsISO8601()
  declare heldUntil: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CalendarDayAppointmentDto)
  declare appointment?: CalendarDayAppointmentDto;
}
