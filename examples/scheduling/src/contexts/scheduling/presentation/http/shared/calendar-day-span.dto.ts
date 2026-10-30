import { IsISO8601 } from 'class-validator';

/** A span of time between two instants. */
export class CalendarDaySpanDto {
  @IsISO8601()
  declare startsAt: string;

  @IsISO8601()
  declare endsAt: string;
}
