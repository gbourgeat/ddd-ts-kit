import { IsString } from 'class-validator';

export class GetAppointmentParams {
  @IsString()
  appointmentId = '';
}
