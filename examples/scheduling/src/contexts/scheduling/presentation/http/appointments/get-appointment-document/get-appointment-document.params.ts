import { IsString } from 'class-validator';

export class GetAppointmentDocumentParams {
  @IsString()
  appointmentId = '';
}
