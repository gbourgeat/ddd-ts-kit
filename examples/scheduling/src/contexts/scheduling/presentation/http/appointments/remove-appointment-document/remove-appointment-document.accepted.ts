import { IsString } from 'class-validator';

export class RemoveAppointmentDocumentAccepted {
  @IsString()
  id = '';
}
