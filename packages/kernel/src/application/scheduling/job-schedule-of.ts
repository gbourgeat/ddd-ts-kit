import type { DurationText } from './duration-text.js';
import { InvalidJobScheduleError } from './invalid-job-schedule-error.js';
import type { JobSchedule } from './job-schedule.js';
import { parseJobSchedule } from './parse-job-schedule.js';

/** The keys of a schedule as they are written next to other options, before they are known to be one schedule. */
export interface WrittenSchedule {
  readonly every?: number | DurationText;
  readonly cron?: string;
  readonly timeZone?: string;
}

/** The schedule among the written keys, validated: an interval or a cron, never both, never neither. */
export function jobScheduleOf({ every, cron, timeZone }: WrittenSchedule): JobSchedule {
  const schedule: JobSchedule | undefined =
    cron === undefined
      ? every === undefined
        ? undefined
        : { every }
      : { cron, ...(timeZone === undefined ? {} : { timeZone }) };

  if (
    schedule === undefined ||
    (cron !== undefined && every !== undefined) ||
    (cron === undefined && timeZone !== undefined)
  ) {
    throw new InvalidJobScheduleError('A schedule is either { every } or { cron, timeZone? }.');
  }

  parseJobSchedule(schedule);

  return schedule;
}
