import { IsString } from 'class-validator';

export class MarkAppointmentNoShowAccepted {
  @IsString()
  id = '';
}
