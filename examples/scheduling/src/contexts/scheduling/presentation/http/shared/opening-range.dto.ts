import { IsIn, Matches } from 'class-validator';
import { Weekday } from '@/contexts/scheduling/calendars/domain/vocabularies/weekday.vocabulary';

/** One range of the week: its weekday and its two wall-clock times `HH:MM`. */
export class OpeningRangeDto {
  @IsIn(Object.values(Weekday))
  weekday: Weekday = Weekday.Monday;

  @Matches(/^\d{2}:\d{2}$/)
  start = '';

  @Matches(/^\d{2}:\d{2}$/)
  end = '';
}
