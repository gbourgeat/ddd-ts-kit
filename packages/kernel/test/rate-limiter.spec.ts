import { describe, expect, it } from 'vitest';
import { FixedClock, InMemoryRateLimiter, rateLimitDecisionOf } from '../src/index.js';

const NOW = new Date('2026-03-01T10:00:00.000Z');
const TWO_PER_SECOND = { limit: 2, windowMs: 1_000 };

describe('InMemoryRateLimiter', () => {
  it('allows calls up to the limit, then says when the oldest one leaves the window', async () => {
    const clock = new FixedClock(NOW);
    const limiter = new InMemoryRateLimiter(clock);

    const first = await limiter.consume('client-a', TWO_PER_SECOND);

    clock.advance(300);
    const second = await limiter.consume('client-a', TWO_PER_SECOND);
    const refused = await limiter.consume('client-a', TWO_PER_SECOND);

    expect([first, second, refused]).toEqual([
      { allowed: true, remaining: 1, retryAfterMs: 0 },
      { allowed: true, remaining: 0, retryAfterMs: 0 },
      { allowed: false, remaining: 0, retryAfterMs: 700 },
    ]);
  });

  it('slides: a call is allowed again once the oldest one has left the window, and keys stay apart', async () => {
    const clock = new FixedClock(NOW);
    const limiter = new InMemoryRateLimiter(clock);

    await limiter.consume('client-a', TWO_PER_SECOND);
    await limiter.consume('client-a', TWO_PER_SECOND);

    expect((await limiter.consume('client-b', TWO_PER_SECOND)).allowed).toBe(true);
    clock.advance(1_000);

    expect(await limiter.consume('client-a', TWO_PER_SECOND)).toEqual({ allowed: true, remaining: 1, retryAfterMs: 0 });
  });
});

describe('rateLimitDecisionOf', () => {
  it('never tells a refused caller to come back at once', () => {
    const counted = { allowed: false, calls: 2, oldest: NOW.getTime() - 1_000, now: NOW.getTime() };

    expect(rateLimitDecisionOf(counted, TWO_PER_SECOND)).toEqual({ allowed: false, remaining: 0, retryAfterMs: 1 });
  });
});
