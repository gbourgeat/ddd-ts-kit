import { IsString } from 'class-validator';

export class CancelAppointmentAccepted {
  @IsString()
  id = '';
}
