import { IsString } from 'class-validator';

export class RescheduleAppointmentParams {
  @IsString()
  declare appointmentId: string;
}
