import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { pickClass } from '@ddd-ts-kit/validation/class-validator';
import { TimeSpan } from '@/contexts/scheduling/presentation/http/shared/time-span.schema';

/** The start of the appointment, picked from TimeSpan: its end follows from its type. */
export class BookAppointmentBody extends pickClass(TimeSpan, ['startsAt']) {
  @IsString()
  @IsNotEmpty()
  calendarId = '';

  @IsString()
  @IsNotEmpty()
  appointmentTypeId = '';

  /** Who the appointment is for; left out, the caller. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  patientId?: string;
}
