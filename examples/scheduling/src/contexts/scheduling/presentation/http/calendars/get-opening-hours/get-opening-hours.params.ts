import { IsString } from 'class-validator';

export class GetOpeningHoursParams {
  @IsString()
  calendarId = '';
}
