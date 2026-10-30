import type { Clock } from '@ddd-ts-kit/kernel';

const DAY_MS = 86_400_000;

/** The instant before which a purge reaches what finished. */
export function daysBefore(clock: Clock, days: number): Date {
  return new Date(clock.now().getTime() - days * DAY_MS);
}
