import { IsString } from 'class-validator';

export class ConfirmAppointmentParams {
  @IsString()
  declare appointmentId: string;
}
