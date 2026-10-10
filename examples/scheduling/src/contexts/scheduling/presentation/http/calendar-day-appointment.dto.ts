import { IsIn, IsString } from 'class-validator';

/** The appointment behind a held slot, for whoever may read it. */
export class CalendarDayAppointmentDto {
  @IsString()
  id = '';

  @IsString()
  patientId = '';

  @IsString()
  appointmentTypeId = '';

  @IsIn(['requested', 'booked'])
  status: 'requested' | 'booked' = 'booked';
}
