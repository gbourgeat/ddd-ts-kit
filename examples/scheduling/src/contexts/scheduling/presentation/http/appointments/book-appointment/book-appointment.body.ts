import { IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
}
