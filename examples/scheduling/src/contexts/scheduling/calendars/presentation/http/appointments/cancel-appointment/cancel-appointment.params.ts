import { IsString } from 'class-validator';

export class CancelAppointmentParams {
  @IsString()
  declare appointmentId: string;
}
