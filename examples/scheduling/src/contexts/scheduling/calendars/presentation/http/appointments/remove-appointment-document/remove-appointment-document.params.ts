import { IsString } from 'class-validator';

export class RemoveAppointmentDocumentParams {
  @IsString()
  declare appointmentId: string;
}
