import type { RateLimitDecision } from '../rate-limit/rate-limit-decision.js';
import type { RateLimit } from '../rate-limit/rate-limit.js';

/**
 * A sliding window: at any instant, at most `limit` allowed calls in the `windowMs` before
 * it. A refused call is not counted. The key is whatever is limited: a client, a tenant, a
 * route and an address together.
 */
export abstract class RateLimiter {
  static readonly tokenKey = 'kernel.RateLimiter';

  abstract consume(key: string, limit: RateLimit): Promise<RateLimitDecision>;
}
