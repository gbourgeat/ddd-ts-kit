import { IsString } from 'class-validator';

export class RescheduleAppointmentAccepted {
  @IsString()
  id = '';
}
