import type { Backoff } from './backoff.js';
import { fullJitter } from './full-jitter.js';

const DEFAULT_FACTOR = 2;
const DEFAULT_MAX_MS = 30_000;

/** The delay waited after the failed attempt of that number, the first being 1. */
export function delayBeforeRetry(attempt: number, backoff: Backoff): number {
  const exponential = backoff.baseMs * (backoff.factor ?? DEFAULT_FACTOR) ** (attempt - 1);
  const capped = Math.min(exponential, backoff.maxMs ?? DEFAULT_MAX_MS);

  return Math.max(0, (backoff.jitter ?? fullJitter())(capped, attempt));
}
