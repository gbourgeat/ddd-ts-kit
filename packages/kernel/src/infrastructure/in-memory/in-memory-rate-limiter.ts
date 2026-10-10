import type { Clock } from '../../application/ports/clock.js';
import type { RateLimiter } from '../../application/ports/rate-limiter.js';
import { rateLimitDecisionOf } from '../../application/rate-limit/rate-limit-decision-of.js';
import type { RateLimitDecision } from '../../application/rate-limit/rate-limit-decision.js';
import type { RateLimit } from '../../application/rate-limit/rate-limit.js';

/** The limiter inside one process: the fake, and enough for a single instance. */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly calls = new Map<string, number[]>();

  constructor(private readonly clock: Clock) {}

  async consume(key: string, limit: RateLimit): Promise<RateLimitDecision> {
    const now = this.clock.now().getTime();
    const inWindow = (this.calls.get(key) ?? []).filter((at) => at > now - limit.windowMs);
    const allowed = inWindow.length < limit.limit;

    if (allowed) {
      inWindow.push(now);
    }

    this.calls.set(key, inWindow);

    return rateLimitDecisionOf({ allowed, calls: inWindow.length, oldest: inWindow[0] ?? now, now }, limit);
  }
}
