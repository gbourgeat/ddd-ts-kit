import { IsISO8601, IsIn, IsString, Matches } from 'class-validator';

export class AppointmentCancelledV1Payload {
  @IsString()
  declare appointmentId: string;

  @IsString()
  declare calendarId: string;

  @IsString()
  declare practiceId: string;

  @IsString()
  declare practitionerId: string;

  @IsString()
  declare patientId: string;

  @IsISO8601()
  declare startsAt: string;

  @IsISO8601()
  declare endsAt: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  declare day: string;

  @IsIn(['patient', 'practice'])
  declare cancelledBy: 'patient' | 'practice';
}
