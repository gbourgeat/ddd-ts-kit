import { describe, expect, it } from 'vitest';
import * as kernel from '@ddd-ts-kit/kernel';
import * as contracts from '@ddd-ts-kit/testing/contracts';
import * as redis from '../src/index.js';
import * as redisTesting from '../src/testing.js';

describe('the names this package had before the ports moved to the kernel', () => {
  it('still gives the in-memory lock and rate limiter, which are those of the kernel', () => {
    expect(redis.InMemoryLock).toBe(kernel.InMemoryLock);
    expect(redis.InMemoryRateLimiter).toBe(kernel.InMemoryRateLimiter);
  });

  it('gives the lock and rate limiter ports as the classes of the kernel, which are their injection tokens', () => {
    expect(redis.Lock).toBe(kernel.Lock);
    expect(redis.RateLimiter).toBe(kernel.RateLimiter);
  });

  it('still gives the three contract suites, which are those of the testing package', () => {
    expect(redisTesting.cacheContract).toBe(contracts.cacheContract);
    expect(redisTesting.lockContract).toBe(contracts.lockContract);
    expect(redisTesting.rateLimiterContract).toBe(contracts.rateLimiterContract);
  });
});
