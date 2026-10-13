import { IsString } from 'class-validator';

export class AttachAppointmentDocumentAccepted {
  @IsString()
  id = '';
}
