import { IsISO8601, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Long enough for what a practitioner writes between two patients, short enough to stay a note. */
const NOTE_LENGTH = 2000;

export class BookAppointmentBody {
  @IsString()
  @IsNotEmpty()
  calendarId = '';

  @IsString()
  @IsNotEmpty()
  appointmentTypeId = '';

  /** The instant the appointment starts, ISO 8601 with its zone. */
  @IsISO8601({ strict: true })
  startsAt = '';

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
