import type { ParsedJobSchedule } from '@ddd-ts-kit/kernel';
import { localDayOf } from './local-day-of.js';
import { occurrencesOfDay } from './occurrences-of-day.js';

/** Two 29ths of February are at most eight years apart. */
const HORIZON_DAYS = 366 * 8 + 2;

/** The first occurrence of the schedule strictly after an instant. */
export function nextOccurrence(schedule: ParsedJobSchedule, after: Date): Date {
  const instant = after.getTime();

  if (schedule.kind === 'interval') return new Date((Math.floor(instant / schedule.everyMs) + 1) * schedule.everyMs);

  const firstDay = localDayOf(schedule, instant) - 1;

  for (let day = firstDay; day < firstDay + HORIZON_DAYS; day += 1) {
    const found = occurrencesOfDay(schedule, day).find((occurrence) => occurrence > instant);

    if (found !== undefined) return new Date(found);
  }

  throw new RangeError(`Cron "${schedule.expression}" has no occurrence in the eight years after ${after.toISOString()}.`);
}
