import { IsString } from 'class-validator';

export class DefineAppointmentTypeAccepted {
  @IsString()
  id = '';
}
