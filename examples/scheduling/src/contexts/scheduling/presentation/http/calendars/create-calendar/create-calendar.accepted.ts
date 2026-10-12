import { IsString } from 'class-validator';

export class CreateCalendarAccepted {
  @IsString()
  id = '';
}
