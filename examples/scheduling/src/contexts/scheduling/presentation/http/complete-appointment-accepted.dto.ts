import { IsString } from 'class-validator';

export class CompleteAppointmentAccepted {
  @IsString()
  id = '';
}
