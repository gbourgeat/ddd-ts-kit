import type { Weekday } from '@/contexts/scheduling/domain/value-objects/opening-hours.vo';

/** The weekly hours of a calendar, each range on its weekday as two wall-clock times `HH:MM`, and the version they were read at. */
export interface GetOpeningHoursResult {
  readonly calendarId: string;
  readonly timeZone: string;
  /** The version of the calendar: what a change of its hours names in `If-Match`. */
  readonly version: number;
  readonly ranges: readonly { readonly weekday: Weekday; readonly start: string; readonly end: string }[];
}
