import { Matches } from 'class-validator';

/** One range of a day: its two wall-clock times `HH:MM`. */
export class DayRangeDto {
  @Matches(/^\d{2}:\d{2}$/)
  declare start: string;

  @Matches(/^\d{2}:\d{2}$/)
  declare end: string;
}
