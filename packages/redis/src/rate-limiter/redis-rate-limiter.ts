import { randomBytes } from 'node:crypto';
import type { Redis } from 'ioredis';
import { SystemClock, rateLimitDecisionOf, type Clock, type RateLimit, type RateLimitDecision, type RateLimiter } from '@ddd-ts-kit/kernel';
import { namespaced } from '../keys/namespaced.js';
import { listOf } from '../replies/list-of.js';

export interface RedisRateLimiterOptions {
  /** Prefix of the keys. Default `rate`. */
  readonly namespace?: string;

  /**
   * The instants come from the caller, not from the server: every instance must run on a
   * synchronized clock, and a skew between two of them shifts the window by as much.
   */
  readonly clock?: Clock;

  /**
   * What to answer while the server is away. `throw` (default) lets the caller decide;
   * `allow` keeps the application serving without a limit; `deny` refuses every call.
   */
  readonly onError?: 'throw' | 'allow' | 'deny';
}

/**
 * Forgets the calls that left the window, then counts and records this one in the same step:
 * two concurrent calls cannot both take the last place. Lua is kept to comparisons, the
 * arithmetic is done by the caller. KEYS: calls. ARGV: cutoff, limit, now, member, window.
 * Answers allowed, calls in the window, score of the oldest.
 */
const CONSUME = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
local calls = redis.call('ZCARD', KEYS[1])
local allowed = 0
if calls < tonumber(ARGV[2]) then
  redis.call('ZADD', KEYS[1], ARGV[3], ARGV[4])
  redis.call('PEXPIRE', KEYS[1], ARGV[5])
  calls = calls + 1
  allowed = 1
end
local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
return {allowed, calls, oldest[2]}`;

/**
 * An exact sliding window, as a sorted set of the instants of the allowed calls: one member
 * per call, so a key costs memory in proportion to its limit. For limits in the tens of
 * thousands per window, count in a coarser key instead.
 */
export class RedisRateLimiter implements RateLimiter {
  private readonly client: Redis;

  private readonly namespace: string;

  private readonly clock: Clock;

  private readonly onError: 'throw' | 'allow' | 'deny';

  constructor(client: Redis, options: RedisRateLimiterOptions = {}) {
    this.client = client;
    this.namespace = options.namespace ?? 'rate';
    this.clock = options.clock ?? new SystemClock();
    this.onError = options.onError ?? 'throw';
  }

  async consume(key: string, limit: RateLimit): Promise<RateLimitDecision> {
    const now = this.clock.now().getTime();

    try {
      const answer = await this.client.eval(CONSUME, 1, namespaced(this.namespace, key), ...argumentsOf(now, limit));
      const [allowed, calls, oldest] = listOf(answer);

      return rateLimitDecisionOf({ allowed: Number(allowed) === 1, calls: Number(calls), oldest: Number(oldest ?? now), now }, limit);
    } catch (error) {
      if (this.onError === 'throw') throw error;

      const allowed = this.onError === 'allow';

      return { allowed, remaining: 0, retryAfterMs: allowed ? 0 : limit.windowMs };
    }
  }
}

function argumentsOf(now: number, limit: RateLimit): string[] {
  const member = `${now}-${randomBytes(8).toString('hex')}`;

  return [String(now - limit.windowMs), String(limit.limit), String(now), member, String(Math.max(1, Math.ceil(limit.windowMs)))];
}
