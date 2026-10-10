import { Type } from 'class-transformer';
import { IsISO8601, IsOptional, ValidateNested } from 'class-validator';
import { CalendarDayAppointmentDto } from '@/contexts/scheduling/presentation/http/calendar-day-appointment.dto.js';

/** A held slot: busy, and whose appointment it is only when the asker may read it. */
export class CalendarDayBusyDto {
  @IsISO8601()
  startsAt = '';

  @IsISO8601()
  endsAt = '';

  /** The end of what is held, the buffer after the appointment included. */
  @IsISO8601()
  heldUntil = '';

  @IsOptional()
  @ValidateNested()
  @Type(() => CalendarDayAppointmentDto)
  appointment?: CalendarDayAppointmentDto;
}
