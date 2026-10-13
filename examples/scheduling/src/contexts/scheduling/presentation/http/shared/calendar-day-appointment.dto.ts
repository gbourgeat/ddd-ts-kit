import { IsIn, IsString } from 'class-validator';
import { AppointmentStatus } from '@/contexts/scheduling/domain/vocabularies/appointment-status.vocabulary';

/** The appointment behind a held slot, for whoever may read it. */
export class CalendarDayAppointmentDto {
  @IsString()
  id = '';

  @IsString()
  patientId = '';

  @IsString()
  appointmentTypeId = '';

  @IsIn([AppointmentStatus.Requested, AppointmentStatus.Booked])
  status: typeof AppointmentStatus.Requested | typeof AppointmentStatus.Booked = AppointmentStatus.Booked;
}
