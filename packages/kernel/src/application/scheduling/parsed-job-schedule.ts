export interface ParsedInterval {
  readonly kind: 'interval';
  readonly everyMs: number;
}

/** A cron expression as the sets of values it allows, each sorted. */
export interface ParsedCron {
  readonly kind: 'cron';
  readonly expression: string;
  readonly timeZone: string;
  readonly minutes: readonly number[];
  readonly hours: readonly number[];
  readonly daysOfMonth: readonly number[];
  readonly months: readonly number[];
  /** 0 is Sunday. */
  readonly daysOfWeek: readonly number[];
  /** False when the field starts with `*`. When both day fields are restricted, a day matching either one fits. */
  readonly dayOfMonthRestricted: boolean;
  readonly dayOfWeekRestricted: boolean;
  /**
   * True when the hour field starts with `*`: the job follows elapsed time and keeps its rhythm
   * when clocks are set back. Otherwise a local time that occurs twice runs once.
   */
  readonly everyHour: boolean;
}

export type ParsedJobSchedule = ParsedInterval | ParsedCron;
