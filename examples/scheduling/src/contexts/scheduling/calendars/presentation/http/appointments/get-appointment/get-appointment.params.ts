import { IsString } from 'class-validator';

export class GetAppointmentParams {
  @IsString()
  declare appointmentId: string;
}
