import { InvalidJobScheduleError } from '../scheduling/invalid-job-schedule-error.js';
import { parseDuration } from '../scheduling/parse-duration.js';
import type { BackgroundJobOptions } from './background-job-options.js';
import type { JobBackoff } from './job-backoff.js';

/** The options of a background job with their defaults filled in, durations in milliseconds. */
export interface BackgroundJobPolicy {
  readonly maxAttempts: number;
  readonly backoff: Required<JobBackoff>;
  readonly leaseMs: number;
  readonly timeoutMs?: number;
}

const DEFAULT_LEASE_MS = 30_000;

const DEFAULT_BACKOFF: Required<JobBackoff> = { baseMs: 1_000, factor: 2, maxMs: 300_000 };

/** Validates the options and fills in the defaults. Throws `InvalidJobScheduleError`. */
export function backgroundJobPolicy(options: BackgroundJobOptions = {}): BackgroundJobPolicy {
  const { maxAttempts = 5, backoff = {}, lease = DEFAULT_LEASE_MS, timeout } = options;
  const filled = { ...DEFAULT_BACKOFF, ...backoff };

  assertWhole('maxAttempts', maxAttempts, 1);
  assertWhole('backoff.baseMs', filled.baseMs, 0);
  assertWhole('backoff.maxMs', filled.maxMs, filled.baseMs);

  if (!Number.isFinite(filled.factor) || filled.factor < 1) {
    throw new InvalidJobScheduleError(`backoff.factor is ${filled.factor}: a number of 1 or more is expected.`);
  }

  const policy = { maxAttempts, backoff: filled, leaseMs: parseDuration(lease) };

  return timeout === undefined ? policy : { ...policy, timeoutMs: parseDuration(timeout) };
}

function assertWhole(option: string, value: number, least: number): void {
  if (Number.isSafeInteger(value) && value >= least) {
    return;
  }

  throw new InvalidJobScheduleError(`${option} is ${value}: a whole number of ${least} or more is expected.`);
}
