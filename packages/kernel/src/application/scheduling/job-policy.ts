import { InvalidJobScheduleError } from './invalid-job-schedule-error.js';
import type { JobOptions } from './job-options.js';
import { parseDuration } from './parse-duration.js';

/** The options with their defaults filled in. */
export type JobPolicy = Required<Omit<JobOptions, 'timeoutMs'>> & Pick<JobOptions, 'timeoutMs'>;

/** Validates the options and fills in the defaults. Throws `InvalidJobScheduleError`. */
export function jobPolicy(options: JobOptions): JobPolicy {
  const { overlap = 'skip', missed = 'skip', timeoutMs, jitterMs = 0, enabled = true, singleInstance = true } = options;
  const tenancy = options.tenancy ?? 'global';

  assertOneOf('overlap', overlap, ['skip', 'queue']);
  assertOneOf('missed', missed, ['skip', 'run-once']);
  assertOneOf('tenancy', tenancy, ['global', 'per-tenant']);

  if (!Number.isSafeInteger(jitterMs) || jitterMs < 0) {
    throw new InvalidJobScheduleError(
      `jitterMs is ${jitterMs}: a whole number of milliseconds, zero or more, is expected.`,
    );
  }

  if (timeoutMs === undefined) {
    return { overlap, missed, jitterMs, enabled, singleInstance, tenancy };
  }

  return { overlap, missed, jitterMs, enabled, singleInstance, tenancy, timeoutMs: parseDuration(timeoutMs) };
}

function assertOneOf(option: string, value: string, allowed: readonly string[]): void {
  if (allowed.includes(value)) {
    return;
  }

  throw new InvalidJobScheduleError(`${option} is "${value}": one of ${allowed.join(', ')} is expected.`);
}
