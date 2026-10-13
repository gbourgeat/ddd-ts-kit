import { IsISO8601, IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { AppointmentStatus } from '@/contexts/scheduling/domain/vocabularies/appointment-status.vocabulary';

/** One appointment as every search of the agenda answers it: declared once, documented once as AgendaLine. */
export class AgendaLine {
  @IsString()
  id = '';

  @IsString()
  calendarId = '';

  @IsString()
  practiceId = '';

  @IsString()
  practitionerId = '';

  @IsString()
  patientId = '';

  @IsString()
  appointmentTypeId = '';

  @IsISO8601()
  startsAt = '';

  @IsISO8601()
  endsAt = '';

  /** The date of the start in the time zone of the practice. */
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  day = '';

  @IsIn(Object.values(AppointmentStatus))
  status: AppointmentStatus = AppointmentStatus.Booked;

  /** Only while requested: the instant before which the appointment must be confirmed. */
  @IsOptional()
  @IsISO8601()
  confirmBefore?: string;

  /** Only once cancelled: who cancelled. */
  @IsOptional()
  @IsIn(['patient', 'practice'])
  cancelledBy?: 'patient' | 'practice';
}
