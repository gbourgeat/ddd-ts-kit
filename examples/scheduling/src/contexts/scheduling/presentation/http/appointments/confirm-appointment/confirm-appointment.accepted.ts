import { IsString } from 'class-validator';

export class ConfirmAppointmentAccepted {
  @IsString()
  id = '';
}
