import type { ParsedCron, ParsedJobSchedule } from '@ddd-ts-kit/kernel';
import { localDayOf } from './local-day-of.js';
import { occurrencesOfDay } from './occurrences-of-day.js';

export interface OccurrenceRange {
  /** Excluded. */
  readonly after: Date;
  /** Included. */
  readonly notAfter: Date;
}

/** The last occurrence of the schedule in the range, `undefined` when it holds none. */
export function latestOccurrence(schedule: ParsedJobSchedule, range: OccurrenceRange): Date | undefined {
  const from = range.after.getTime();
  const until = range.notAfter.getTime();
  const latest = schedule.kind === 'interval' ? Math.floor(until / schedule.everyMs) * schedule.everyMs : latestOfCron(schedule, until, from);

  return latest === undefined || latest <= from ? undefined : new Date(latest);
}

function latestOfCron(cron: ParsedCron, until: number, from: number): number | undefined {
  const lastDay = localDayOf(cron, from) - 1;

  for (let day = localDayOf(cron, until) + 1; day >= lastDay; day -= 1) {
    const found = occurrencesOfDay(cron, day).findLast((occurrence) => occurrence <= until);

    if (found !== undefined) return found;
  }

  return undefined;
}
