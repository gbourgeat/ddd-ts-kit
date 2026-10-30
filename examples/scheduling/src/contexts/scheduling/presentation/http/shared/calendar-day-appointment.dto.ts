import { IsIn, IsString } from 'class-validator';
import { AppointmentStatus } from '@/contexts/scheduling/calendars/domain/vocabularies/appointment-status.vocabulary';

/** The appointment behind a held slot, for whoever may read it. */
export class CalendarDayAppointmentDto {
  @IsString()
  declare id: string;

  @IsString()
  declare patientId: string;

  @IsString()
  declare appointmentTypeId: string;

  @IsIn([AppointmentStatus.Requested, AppointmentStatus.Booked])
  declare status: typeof AppointmentStatus.Requested | typeof AppointmentStatus.Booked;
}
