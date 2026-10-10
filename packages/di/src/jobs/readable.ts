import { InvalidJobScheduleError } from '@ddd-ts-kit/kernel';
import { WiringError } from '../errors/wiring-error.js';

/** Reads a schedule or a policy of the job, and says which job when it cannot be read. */
export function readable<T>(job: string, read: () => T): T {
  try {
    return read();
  } catch (error) {
    if (!(error instanceof InvalidJobScheduleError)) throw error;

    throw new WiringError('INVALID_JOB_SETTINGS', `Job "${job}": ${error.message}`, { cause: error });
  }
}
