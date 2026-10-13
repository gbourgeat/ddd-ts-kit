import { IsString } from 'class-validator';

export class AttachAppointmentDocumentParams {
  @IsString()
  appointmentId = '';
}
