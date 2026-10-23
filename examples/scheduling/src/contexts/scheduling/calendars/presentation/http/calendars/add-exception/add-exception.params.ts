import { IsString } from 'class-validator';

export class AddExceptionParams {
  @IsString()
  calendarId = '';
}
