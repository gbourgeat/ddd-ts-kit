import { IsString } from 'class-validator';

export class GetAppointmentDocumentParams {
  @IsString()
  declare appointmentId: string;
}
