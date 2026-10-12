import { IsString } from 'class-validator';

export class AddTimeOffParams {
  @IsString()
  calendarId = '';
}
