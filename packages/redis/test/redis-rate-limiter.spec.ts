import type { Redis } from 'ioredis';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { FixedClock } from '@ddd-ts-kit/kernel';
import { RedisRateLimiter } from '../src/index.js';
import { rateLimiterContract } from '../src/testing.js';
import { REAL_SERVER, aNamespace, closeAll, connect, connectToNothing, sleep } from './support/server.js';

const runner = { describe, it, expect, beforeEach };
const NOW = new Date('2026-03-01T10:00:00.000Z');

afterAll(closeAll);

describe.skipIf(!REAL_SERVER)('RedisRateLimiter on a server', () => {
  let client: Redis;
  let clock: FixedClock;

  beforeEach(() => {
    client ??= connect();
  });

  rateLimiterContract(runner, {
    name: 'RedisRateLimiter',
    createLimiter: () => {
      clock = new FixedClock(NOW);

      return new RedisRateLimiter(client, { namespace: aNamespace(), clock });
    },
    elapse: (ms) => clock.advance(ms),
  });

  it('shares one window between the instances of an application', async () => {
    const namespace = aNamespace();
    const shared = new FixedClock(NOW);
    const instances = [connect(), connect(), connect()].map((connection) => new RedisRateLimiter(connection, { namespace, clock: shared }));

    const calls = Array.from({ length: 10 }, () => instances).flat();
    const decisions = await Promise.all(calls.map((instance) => instance.consume('tenant-acme', { limit: 7, windowMs: 60_000 })));

    expect(decisions.filter((decision) => decision.allowed)).toHaveLength(7);
    expect(decisions.filter((decision) => decision.allowed).map((decision) => decision.remaining).sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('keeps one member per allowed call and lets the server forget the key after the window', async () => {
    const namespace = aNamespace();
    const limiter = new RedisRateLimiter(client, { namespace, clock: new FixedClock(NOW) });

    for (let call = 0; call < 5; call += 1) await limiter.consume('tenant-acme', { limit: 3, windowMs: 45_000 });

    expect(await client.zcard(`${namespace}:tenant-acme`)).toBe(3);
    expect(await client.pttl(`${namespace}:tenant-acme`)).toBeGreaterThan(40_000);
  });

  it('limits on the clock of the machine by default', async () => {
    const limiter = new RedisRateLimiter(client, { namespace: aNamespace() });
    const twoPerWindow = { limit: 2, windowMs: 300 };

    await limiter.consume('tenant-acme', twoPerWindow);
    await limiter.consume('tenant-acme', twoPerWindow);

    const refused = await limiter.consume('tenant-acme', twoPerWindow);

    await sleep(refused.retryAfterMs + 20);

    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterMs).toBeGreaterThan(200);
    expect(refused.retryAfterMs).toBeLessThanOrEqual(300);
    expect((await limiter.consume('tenant-acme', twoPerWindow)).allowed).toBe(true);
  });
});

describe('RedisRateLimiter while the server is away', () => {
  const limit = { limit: 3, windowMs: 1_000 };

  it('fails by default: the caller decides what an unknown count means', async () => {
    await expect(new RedisRateLimiter(connectToNothing()).consume('tenant-acme', limit)).rejects.toThrow();
  });

  it('allows every call when told to stay open', async () => {
    const limiter = new RedisRateLimiter(connectToNothing(), { onError: 'allow' });

    expect(await limiter.consume('tenant-acme', limit)).toEqual({ allowed: true, remaining: 0, retryAfterMs: 0 });
  });

  it('refuses every call when told to stay closed', async () => {
    const limiter = new RedisRateLimiter(connectToNothing(), { onError: 'deny' });

    expect(await limiter.consume('tenant-acme', limit)).toEqual({ allowed: false, remaining: 0, retryAfterMs: 1_000 });
  });
});
