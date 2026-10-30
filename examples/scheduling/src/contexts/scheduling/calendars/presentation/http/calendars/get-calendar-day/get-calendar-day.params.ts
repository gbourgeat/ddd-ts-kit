import { IsString, Matches } from 'class-validator';

export class GetCalendarDayParams {
  @IsString()
  declare calendarId: string;

  /** `YYYY-MM-DD` in the time zone of the practice. */
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  declare day: string;
}
