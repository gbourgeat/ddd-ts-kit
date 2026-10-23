import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { pickClass } from '@ddd-ts-kit/validation/class-validator';
import { TimeSpan } from '@/contexts/scheduling/presentation/http/shared/time-span.schema';

/** Long enough for what a practitioner writes between two patients, short enough to stay a note. */
const NOTE_LENGTH = 2000;

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

  /** What the staff of the practice keeps about the appointment: who may see and set it is said where the body is declared. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(NOTE_LENGTH)
  internalNote?: string;
}
