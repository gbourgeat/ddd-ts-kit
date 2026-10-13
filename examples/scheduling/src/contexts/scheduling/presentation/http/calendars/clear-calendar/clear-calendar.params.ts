import { IsString } from 'class-validator';

export class ClearCalendarParams {
  @IsString()
  calendarId = '';
}
