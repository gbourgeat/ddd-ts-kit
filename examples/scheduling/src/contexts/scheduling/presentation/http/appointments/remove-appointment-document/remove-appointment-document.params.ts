import { IsString } from 'class-validator';

export class RemoveAppointmentDocumentParams {
  @IsString()
  appointmentId = '';
}
