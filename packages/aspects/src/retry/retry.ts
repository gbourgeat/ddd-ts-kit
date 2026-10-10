import type { AdviceFactory } from '../aspect/advice-factory.js';
import type { Aspect } from '../aspect/aspect.js';
import { defineAspect } from '../aspect/define-aspect.js';
import { schedulerOr } from '../runtime/scheduler-or.js';
import type { Backoff } from './backoff.js';
import { delayBeforeRetry } from './delay-before-retry.js';
import { isTransient } from './is-transient.js';

export interface RetryOptions {
  /** Calls made in total, the first one included. */
  readonly attempts: number;
  /** Default: 100 ms doubling up to 30 seconds, with full jitter. */
  readonly backoff?: Backoff;
  /** Default `isTransient`. */
  readonly retryOn?: (error: unknown) => boolean;
  /** Waits between attempts. Defaults to the scheduler of the aspect runtime. */
  readonly sleep?: (delayMs: number) => Promise<void>;
}

const DEFAULT_BACKOFF: Backoff = { baseMs: 100 };

/**
 * Calls again after a failure that may not happen twice. Never after a `DomainError`: a
 * business refusal is not transient. Only for calls that are safe to repeat.
 */
export function retry(options: RetryOptions): Aspect {
  return defineAspect(retryAdvice(options));
}

export function retryAdvice(options: RetryOptions): AdviceFactory {
  if (!Number.isSafeInteger(options.attempts) || options.attempts < 1) {
    throw new RangeError('retry: attempts is an integer of at least 1');
  }

  const retryOn = options.retryOn ?? isTransient;
  const backoff = options.backoff ?? DEFAULT_BACKOFF;

  return () =>
    async ({ proceed }) => {
      for (let attempt = 1; ; attempt += 1) {
        try {
          return await proceed();
        } catch (error) {
          if (attempt >= options.attempts || !retryOn(error)) {
            throw error;
          }

          await (options.sleep ?? scheduledSleep)(delayBeforeRetry(attempt, backoff));
        }
      }
    };
}

function scheduledSleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    schedulerOr(undefined).schedule(resolve, delayMs);
  });
}
