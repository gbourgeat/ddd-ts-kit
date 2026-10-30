import { IsString } from 'class-validator';

export class ClearCalendarParams {
  @IsString()
  declare calendarId: string;
}
