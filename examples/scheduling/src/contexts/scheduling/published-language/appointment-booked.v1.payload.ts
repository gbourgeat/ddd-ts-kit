import { IsISO8601, IsIn, IsOptional, IsString, Matches } from 'class-validator';

export class AppointmentBookedV1Payload {
  @IsString()
  appointmentId = '';

  @IsString()
  calendarId = '';

  @IsString()
  practiceId = '';

  @IsString()
  practitionerId = '';

  @IsString()
  patientId = '';

  @IsISO8601()
  startsAt = '';

  @IsISO8601()
  endsAt = '';

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  day = '';

  @IsIn(['booked', 'requested'])
  status: 'booked' | 'requested' = 'booked';

  @IsOptional()
  @IsISO8601()
  confirmBefore?: string;
}
