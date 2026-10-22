import type { ParsedCron } from '@ddd-ts-kit/kernel';
import { offsetAt } from './offset-at';

const DAY_MS = 86_400_000;

/** The day the clocks of the zone show at an instant, counted from the epoch. */
export function localDayOf(cron: ParsedCron, instant: number): number {
  return Math.floor((instant + offsetAt(cron.timeZone, instant)) / DAY_MS);
}
