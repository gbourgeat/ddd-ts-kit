import { IsISO8601, IsIn, IsOptional, IsString, Matches } from 'class-validator';

export class ListAppointmentsLine {
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

  @IsIn(['requested', 'booked', 'cancelled', 'expired', 'completed', 'no-show'])
  status: 'requested' | 'booked' | 'cancelled' | 'expired' | 'completed' | 'no-show' = 'booked';

  /** Only while requested: the instant before which the appointment must be confirmed. */
  @IsOptional()
  @IsISO8601()
  confirmBefore?: string;

  /** Only once cancelled: who cancelled. */
  @IsOptional()
  @IsIn(['patient', 'practice'])
  cancelledBy?: 'patient' | 'practice';
}
