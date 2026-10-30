import { IsString } from 'class-validator';

export class CompleteAppointmentParams {
  @IsString()
  declare appointmentId: string;
}
