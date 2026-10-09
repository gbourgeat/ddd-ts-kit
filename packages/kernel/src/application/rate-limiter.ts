export interface RateLimit {
  /** How many calls are allowed in any period of `windowMs`. */
  readonly limit: number;
  readonly windowMs: number;
}

export interface RateLimitDecision {
  readonly allowed: boolean;
  /** Calls still allowed right now, this one counted. */
  readonly remaining: number;
  /** 0 when allowed; otherwise how long until one call is allowed again. */
  readonly retryAfterMs: number;
}

/**
 * A sliding window: at any instant, at most `limit` allowed calls in the `windowMs` before
 * it. A refused call is not counted. The key is whatever is limited: a client, a tenant, a
 * route and an address together.
 */
export interface RateLimiter {
  consume(key: string, limit: RateLimit): Promise<RateLimitDecision>;
}

/** What an adapter of `RateLimiter` counted: the calls in the window, this one included when allowed, and the oldest of them. */
export interface RateLimitWindowCount {
  readonly allowed: boolean;
  readonly calls: number;
  readonly oldest: number;
  readonly now: number;
}

/** For an adapter of `RateLimiter`: the decision that follows from what it counted. */
export function rateLimitDecisionOf({ allowed, calls, oldest, now }: RateLimitWindowCount, limit: RateLimit): RateLimitDecision {
  if (allowed) return { allowed, remaining: Math.max(0, limit.limit - calls), retryAfterMs: 0 };
  return { allowed, remaining: 0, retryAfterMs: Math.max(1, oldest + limit.windowMs - now) };
}
