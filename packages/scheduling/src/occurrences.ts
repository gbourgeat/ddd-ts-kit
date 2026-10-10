import type { ParsedCron, ParsedJobSchedule } from '@ddd-ts-kit/kernel';
import { instantsOfWallTime, offsetAt } from './time-zone.js';

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
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

/** The day the clocks of the zone show at an instant, counted from the epoch. */
function localDayOf(cron: ParsedCron, instant: number): number {
  return Math.floor((instant + offsetAt(cron.timeZone, instant)) / DAY_MS);
}

/** The instants of one local day at which the expression fires, in order. Most days hold no change of offset. */
function occurrencesOfDay(cron: ParsedCron, day: number): number[] {
  if (!firesOn(cron, day)) return [];
  const wallTimes = cron.hours.flatMap((hour) => cron.minutes.map((minute) => day * DAY_MS + hour * HOUR_MS + minute * MINUTE_MS));
  const before = offsetAt(cron.timeZone, (day - 1) * DAY_MS);
  if (before === offsetAt(cron.timeZone, (day + 2) * DAY_MS)) return wallTimes.map((wallTime) => wallTime - before);
  return wallTimes.flatMap((wallTime) => occurrencesAt(cron, wallTime)).sort((left, right) => left - right);
}

/** The day-of-month and day-of-week fields are alternatives when both are restricted, as in every cron. */
function firesOn(cron: ParsedCron, day: number): boolean {
  const date = new Date(day * DAY_MS);
  if (!cron.months.includes(date.getUTCMonth() + 1)) return false;
  const onDayOfMonth = cron.daysOfMonth.includes(date.getUTCDate());
  const onDayOfWeek = cron.daysOfWeek.includes(date.getUTCDay());
  return cron.dayOfMonthRestricted && cron.dayOfWeekRestricted ? onDayOfMonth || onDayOfWeek : onDayOfMonth && onDayOfWeek;
}

/** A wall time that occurs twice runs once, unless the job follows elapsed time (`*` hours). */
function occurrencesAt(cron: ParsedCron, wallTime: number): number[] {
  const instants = instantsOfWallTime(cron.timeZone, wallTime);
  return cron.everyHour ? instants : instants.slice(0, 1);
}
