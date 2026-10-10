import { IsString } from 'class-validator';

export class SetOpeningHoursParams {
  @IsString()
  calendarId = '';
}
