import type { Redis } from 'ioredis';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { cacheKey } from '@ddd-ts-kit/kernel';
import { RedisCache, RedisLock } from '../src';
import { SERVERS, aNamespace, closeAll, connect, serverOf, sleep } from './support/servers';

const price = (sku: string) => cacheKey<{ amount: number }>('price', sku);

afterAll(closeAll);

describe.each(SERVERS)('RedisCache.getOrLoad, %s', (_name, start) => {
  const redis = serverOf(start);

  let client: Redis;

  beforeEach(() => {
    client ??= connect(redis.url);
  });

  it('computes a missing value once for the callers of one process, then answers from the cache', async () => {
    const cache = new RedisCache(client, { namespace: aNamespace() });
    const loads = { count: 0 };

    const load = async () => {
      loads.count += 1;
      await sleep(30);

      return { amount: 12 };
    };

    const answers = await Promise.all(
      Array.from({ length: 5 }, () => cache.getOrLoad(price('sku-1'), load, { ttlMs: 60_000 })),
    );

    const again = await cache.getOrLoad(price('sku-1'), load);

    expect(answers).toEqual(Array.from({ length: 5 }, () => ({ amount: 12 })));
    expect(again).toEqual({ amount: 12 });
    expect(loads.count).toBe(1);
  });

  it('computes it once across processes when given a lock', async () => {
    const namespace = aNamespace();

    const processes = [connect(redis.url), connect(redis.url), connect(redis.url)].map(
      (connection) => new RedisCache(connection, { namespace, lock: new RedisLock(connection, { namespace }) }),
    );

    const loads = { count: 0 };

    const load = async () => {
      loads.count += 1;
      await sleep(80);

      return { amount: 12 };
    };

    const answers = await Promise.all(
      processes.map((cache) => cache.getOrLoad(price('sku-1'), load, { ttlMs: 60_000 })),
    );

    expect(answers).toEqual([{ amount: 12 }, { amount: 12 }, { amount: 12 }]);
    expect(loads.count).toBe(1);
  });

  it('computes the value itself rather than fail when the one computing takes too long', async () => {
    const namespace = aNamespace();
    const lock = new RedisLock(client, { namespace });
    const cache = new RedisCache(client, { namespace, lock });

    await lock.acquire(`cache:${namespace}:price:sku-1`, { ttlMs: 30_000 });

    expect(await cache.getOrLoad(price('sku-1'), async () => ({ amount: 7 }), { waitMs: 60 })).toEqual({ amount: 7 });
  });

  it('does not cache a failure, and lets the next caller try', async () => {
    const cache = new RedisCache(client, {
      namespace: aNamespace(),
      lock: new RedisLock(client, { namespace: aNamespace() }),
    });

    await expect(
      cache.getOrLoad(price('sku-1'), async () => Promise.reject(new Error('The pricing service is away'))),
    ).rejects.toThrow('away');

    expect(await cache.getOrLoad(price('sku-1'), async () => ({ amount: 3 }))).toEqual({ amount: 3 });
  });
});
