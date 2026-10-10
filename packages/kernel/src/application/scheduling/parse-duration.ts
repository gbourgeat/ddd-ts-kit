import { InvalidJobScheduleError } from './invalid-job-schedule-error.js';

const UNIT_MS: Readonly<Record<string, number>> = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };

const DURATION = /^(\d+)(ms|s|m|h|d)$/;

/** Milliseconds of a duration, refusing zero, a fraction and an unknown unit. */
export function parseDuration(duration: number | string): number {
  const ms = typeof duration === 'number' ? duration : durationTextMs(duration);

  if (!Number.isSafeInteger(ms) || ms <= 0) {
    throw new InvalidJobScheduleError(
      `"${duration}" is not a duration: write a positive whole number of milliseconds, or a text such as '30s', '15m', '2h', '1d'.`,
    );
  }

  return ms;
}

function durationTextMs(text: string): number {
  const [, amount, unit] = DURATION.exec(text.trim()) ?? [];

  return Number(amount ?? Number.NaN) * (UNIT_MS[unit ?? ''] ?? Number.NaN);
}
