import type { DurationText } from './duration-text';

/**
 * Every so often, as milliseconds or a duration text. Occurrences are aligned on the Unix epoch
 * (`'15m'` falls at :00, :15, :30 and :45 UTC), so that every instance of an application names
 * the same instants and a restart does not shift them.
 */
export interface IntervalSchedule {
  readonly every: number | DurationText;
  readonly cron?: never;
  readonly timeZone?: never;
}

/**
 * The five standard fields (minute, hour, day of month, month, day of week), read on the
 * clocks of an IANA time zone. Default zone: `UTC`.
 */
export interface CronSchedule {
  readonly cron: string;
  readonly timeZone?: string;
  readonly every?: never;
}

export type JobSchedule = IntervalSchedule | CronSchedule;
