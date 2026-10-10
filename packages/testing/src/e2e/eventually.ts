import { setTimeout as sleep } from 'node:timers/promises';
import { inspect } from 'node:util';

export interface EventuallyOptions {
  /** Default 2000. */
  readonly timeoutMs?: number;
  /** Default 20. */
  readonly intervalMs?: number;
}

/**
 * Runs the assertion again until it passes, and returns what it returned. For outcomes that
 * are eventually consistent: integration events, projections. When the time is up, the
 * failure quotes the last error and carries it as `cause`.
 */
export async function eventually<T>(assertion: () => T | Promise<T>, options: EventuallyOptions = {}): Promise<T> {
  const { timeoutMs = 2000, intervalMs = 20 } = options;
  const deadline = performance.now() + timeoutMs;

  for (;;) {
    try {
      return await assertion();
    } catch (error) {
      if (performance.now() + intervalMs > deadline) {
        throw stillFailing(error, timeoutMs);
      }
    }

    await sleep(intervalMs);
  }
}

function stillFailing(error: unknown, timeoutMs: number): Error {
  const last = error instanceof Error ? error.message : inspect(error);

  return new Error(`Still failing after ${timeoutMs} ms: ${last}`, { cause: error });
}
