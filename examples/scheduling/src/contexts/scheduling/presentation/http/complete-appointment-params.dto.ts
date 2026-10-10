import { IsString } from 'class-validator';

export class CompleteAppointmentParams {
  @IsString()
  appointmentId = '';
}
