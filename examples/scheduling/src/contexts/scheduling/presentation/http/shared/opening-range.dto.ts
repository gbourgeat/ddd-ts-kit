import { IsIn, Matches } from 'class-validator';

/** One range of the week: its weekday and its two wall-clock times `HH:MM`. */
export class OpeningRangeDto {
  @IsIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
  weekday: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday' = 'monday';

  @Matches(/^\d{2}:\d{2}$/)
  start = '';

  @Matches(/^\d{2}:\d{2}$/)
  end = '';
}
