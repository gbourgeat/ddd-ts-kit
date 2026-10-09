import { defineAspect } from './aspect.js';
import type { AdviceFactory, Aspect } from './types.js';
import { BulkheadFullError, CircuitOpenError, isBusinessRefusal } from './errors.js';
import { schedulerOr } from './runtime.js';

/** Turns the computed delay before a retry into the one that is waited. */
export type Jitter = (delayMs: number, attempt: number) => number;

export const noJitter: Jitter = (delayMs) => delayMs;

/**
 * A delay anywhere between zero and the computed one, so that callers failing together do not
 * retry together. Give a seeded `random` to make it deterministic.
 */
export function fullJitter(random: () => number = Math.random): Jitter {
  return (delayMs) => random() * delayMs;
}

export interface Backoff {
  /** Delay before the first retry. */
  readonly baseMs: number;
  /** Multiplies the delay at each retry. Default 2. */
  readonly factor?: number;
  /** The delay never exceeds it. Default 30 seconds. */
  readonly maxMs?: number;
  /** Default `fullJitter()`. */
  readonly jitter?: Jitter;
}

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
const DEFAULT_FACTOR = 2;
const DEFAULT_MAX_MS = 30_000;

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
          if (attempt >= options.attempts || !retryOn(error)) throw error;
          await (options.sleep ?? scheduledSleep)(delayBeforeRetry(attempt, backoff));
        }
      }
    };
}

/**
 * Worth another attempt: anything but a business refusal and the two refusals of this package
 * that protect a dependency (an open circuit, a full bulkhead).
 */
export function isTransient(error: unknown): boolean {
  return !(
    isBusinessRefusal(error) ||
    error instanceof CircuitOpenError ||
    error instanceof BulkheadFullError
  );
}

/** The delay waited after the failed attempt of that number, the first being 1. */
export function delayBeforeRetry(attempt: number, backoff: Backoff): number {
  const exponential = backoff.baseMs * (backoff.factor ?? DEFAULT_FACTOR) ** (attempt - 1);
  const capped = Math.min(exponential, backoff.maxMs ?? DEFAULT_MAX_MS);
  return Math.max(0, (backoff.jitter ?? fullJitter())(capped, attempt));
}

function scheduledSleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    schedulerOr(undefined).schedule(resolve, delayMs);
  });
}
