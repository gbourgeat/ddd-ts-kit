import type { ParsedCron } from '@ddd-ts-kit/kernel';
import { instantsOfWallTime } from './instants-of-wall-time.js';
import { offsetAt } from './offset-at.js';

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** The instants of one local day at which the expression fires, in order. Most days hold no change of offset. */
export function occurrencesOfDay(cron: ParsedCron, day: number): number[] {
  if (!firesOn(cron, day)) {
    return [];
  }

  const wallTimes = cron.hours.flatMap((hour) =>
    cron.minutes.map((minute) => day * DAY_MS + hour * HOUR_MS + minute * MINUTE_MS),
  );

  const before = offsetAt(cron.timeZone, (day - 1) * DAY_MS);

  if (before === offsetAt(cron.timeZone, (day + 2) * DAY_MS)) {
    return wallTimes.map((wallTime) => wallTime - before);
  }

  return wallTimes.flatMap((wallTime) => occurrencesAt(cron, wallTime)).sort((left, right) => left - right);
}

/** The day-of-month and day-of-week fields are alternatives when both are restricted, as in every cron. */
function firesOn(cron: ParsedCron, day: number): boolean {
  const date = new Date(day * DAY_MS);

  if (!cron.months.includes(date.getUTCMonth() + 1)) {
    return false;
  }

  const onDayOfMonth = cron.daysOfMonth.includes(date.getUTCDate());
  const onDayOfWeek = cron.daysOfWeek.includes(date.getUTCDay());

  return cron.dayOfMonthRestricted && cron.dayOfWeekRestricted
    ? onDayOfMonth || onDayOfWeek
    : onDayOfMonth && onDayOfWeek;
}

/** A wall time that occurs twice runs once, unless the job follows elapsed time (`*` hours). */
function occurrencesAt(cron: ParsedCron, wallTime: number): number[] {
  const instants = instantsOfWallTime(cron.timeZone, wallTime);

  return cron.everyHour ? instants : instants.slice(0, 1);
}
