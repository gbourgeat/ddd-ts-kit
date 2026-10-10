import { IsString } from 'class-validator';

export class BookAppointmentAccepted {
  @IsString()
  id = '';
}
