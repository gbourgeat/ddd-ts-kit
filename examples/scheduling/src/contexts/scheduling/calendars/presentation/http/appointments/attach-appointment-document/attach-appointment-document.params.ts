import { IsString } from 'class-validator';

export class AttachAppointmentDocumentParams {
  @IsString()
  declare appointmentId: string;
}
