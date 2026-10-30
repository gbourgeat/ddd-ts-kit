import { IsISO8601, IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { AppointmentStatus } from '@/contexts/scheduling/calendars/domain/vocabularies/appointment-status.vocabulary';

/** One appointment as every search of the agenda answers it: declared once, documented once as AgendaLine. */
export class AgendaLine {
  @IsString()
  declare id: string;

  @IsString()
  declare calendarId: string;

  @IsString()
  declare practiceId: string;

  @IsString()
  declare practitionerId: string;

  @IsString()
  declare patientId: string;

  @IsString()
  declare appointmentTypeId: string;

  @IsISO8601()
  declare startsAt: string;

  @IsISO8601()
  declare endsAt: string;

  /** The date of the start in the time zone of the practice. */
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  declare day: string;

  @IsIn(Object.values(AppointmentStatus))
  declare status: AppointmentStatus;

  /** Only while requested: the instant before which the appointment must be confirmed. */
  @IsOptional()
  @IsISO8601()
  declare confirmBefore?: string;

  /** Only once cancelled: who cancelled. */
  @IsOptional()
  @IsIn(['patient', 'practice'])
  declare cancelledBy?: 'patient' | 'practice';
}
