import type { JobSchedule } from './job-schedule.js';
import { parseJobSchedule } from './parse-job-schedule.js';

/** `every 15m`, or `cron 0 7 * * 1-5 (Europe/Paris)`: the schedule as a diagnostic shows it. */
export function describeJobSchedule(schedule: JobSchedule): string {
  const parsed = parseJobSchedule(schedule);

  if (parsed.kind === 'cron') {
    return `cron ${parsed.expression} (${parsed.timeZone})`;
  }

  return `every ${typeof schedule.every === 'string' ? schedule.every : `${parsed.everyMs}ms`}`;
}
