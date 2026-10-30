import { IsString } from 'class-validator';

export class GetOpeningHoursParams {
  @IsString()
  declare calendarId: string;
}
