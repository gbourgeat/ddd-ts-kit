import { IsString } from 'class-validator';

export class SetOpeningHoursParams {
  @IsString()
  declare calendarId: string;
}
