import { IsString } from 'class-validator';

export class MarkAppointmentNoShowParams {
  @IsString()
  declare appointmentId: string;
}
