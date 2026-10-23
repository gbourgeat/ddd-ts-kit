import type { RateLimitDecision } from './rate-limit-decision';
import type { RateLimit } from './rate-limit';

/** What an adapter of `RateLimiter` counted: the calls in the window, this one included when allowed, and the oldest of them. */
export interface RateLimitWindowCount {
  readonly allowed: boolean;
  readonly calls: number;
  readonly oldest: number;
  readonly now: number;
}

/** For an adapter of `RateLimiter`: the decision that follows from what it counted. */
export function rateLimitDecisionOf(
  { allowed, calls, oldest, now }: RateLimitWindowCount,
  limit: RateLimit,
): RateLimitDecision {
  if (allowed) {
    return { allowed, remaining: Math.max(0, limit.limit - calls), retryAfterMs: 0 };
  }

  return { allowed, remaining: 0, retryAfterMs: Math.max(1, oldest + limit.windowMs - now) };
}
