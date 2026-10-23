import { offsetAt } from './offset-at';

const DAY_MS = 86_400_000;

/**
 * The instants at which the clocks of the zone show a wall time, earliest first: none for a
 * time skipped when clocks are set forward, two for a time repeated when they are set back. A
 * wall time is written as the milliseconds it would be in UTC.
 */
export function instantsOfWallTime(timeZone: string, wallTime: number): number[] {
  const offsets = new Set([offsetAt(timeZone, wallTime - DAY_MS), offsetAt(timeZone, wallTime + DAY_MS)]);

  return [...offsets]
    .filter((offset) => offsetAt(timeZone, wallTime - offset) === offset)
    .map((offset) => wallTime - offset)
    .sort((left, right) => left - right);
}
