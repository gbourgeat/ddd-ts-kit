import type { JobSchedule } from './job-schedule';
import { parseCron } from './parse-cron';
import { parseDuration } from './parse-duration';
import type { ParsedJobSchedule } from './parsed-job-schedule';

/** Validates a schedule and answers it in the form occurrences are computed from. */
export function parseJobSchedule(schedule: JobSchedule): ParsedJobSchedule {
  if (schedule.cron !== undefined) {
    return parseCron(schedule.cron, schedule.timeZone ?? 'UTC');
  }

  return { kind: 'interval', everyMs: parseDuration(schedule.every) };
}
