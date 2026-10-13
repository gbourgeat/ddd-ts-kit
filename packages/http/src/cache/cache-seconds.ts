import type { DurationText } from '@ddd-ts-kit/kernel';

const SECONDS_PER_UNIT: Readonly<Record<string, number>> = { s: 1, m: 60, h: 3_600, d: 86_400 };
const MILLISECONDS_PER_SECOND = 1_000;
const DURATION = /^(\d+)(ms|s|m|h|d)$/;

/** The whole seconds of a duration of a cache directive, zero included; `undefined` when it is none. */
export function cacheSeconds(duration: DurationText): number | undefined {
  const [, amount, unit] = DURATION.exec(duration) ?? [];

  if (amount === undefined || unit === undefined) {
    return undefined;
  }

  const value = Number(amount);

  if (unit === 'ms') {
    return value % MILLISECONDS_PER_SECOND === 0 ? value / MILLISECONDS_PER_SECOND : undefined;
  }

  const seconds = value * (SECONDS_PER_UNIT[unit] ?? Number.NaN);

  return Number.isSafeInteger(seconds) ? seconds : undefined;
}
