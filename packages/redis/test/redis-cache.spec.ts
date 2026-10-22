import type { Redis } from 'ioredis';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { InMemoryMetrics, cacheKey } from '@ddd-ts-kit/kernel';
import { RedisCache, RedisLock, type CacheCodec } from '../src';
import { cacheContract } from '../src/testing';
import { REAL_SERVER, aNamespace, closeAll, connect, connectToNothing, sleep } from './support/server';

const runner = { describe, it, expect, beforeEach };
const price = (sku: string) => cacheKey<{ amount: number }>('price', sku);

afterAll(closeAll);

describe.skipIf(!REAL_SERVER)('RedisCache on a server', () => {
  let client: Redis;

  beforeEach(() => {
    client ??= connect();
  });

  cacheContract(runner, {
    name: 'RedisCache',
    createCache: () => new RedisCache(client, { namespace: aNamespace() }),
    elapse: sleep,
  });

  cacheContract(runner, {
    name: 'RedisCache failing loudly',
    createCache: () => new RedisCache(client, { namespace: aNamespace(), onError: 'throw' }),
    elapse: sleep,
  });

  it('prefixes its keys with the namespace, so that two contexts never read each other', async () => {
    const [billing, shipping] = [aNamespace(), aNamespace()];

    await new RedisCache(client, { namespace: billing }).set(price('sku-1'), { amount: 12 });

    expect(await new RedisCache(client, { namespace: shipping }).get(price('sku-1'))).toBeUndefined();
    expect(await client.get(`${billing}:price:sku-1`)).toBe('{"amount":12}');
  });

  it('stores the time to live on the server, in milliseconds', async () => {
    const namespace = aNamespace();

    await new RedisCache(client, { namespace }).set(price('sku-1'), { amount: 12 }, { ttlMs: 90_000 });

    const remaining = await client.pttl(`${namespace}:price:sku-1`);

    expect(remaining).toBeGreaterThan(80_000);
    expect(remaining).toBeLessThanOrEqual(90_000);
  });

  it('deletes by prefix across more keys than one scan returns, and nothing else', async () => {
    const namespace = aNamespace();
    const cache = new RedisCache(client, { namespace });

    for (let index = 0; index < 450; index += 1) {
      await cache.set(price(`sku-${index}`), { amount: index });
    }

    await cache.set(cacheKey<string>('pricing-rule'), 'kept: the prefix ends with a colon');
    await new RedisCache(client, { namespace: `${namespace}-other` }).set(price('sku-1'), { amount: 1 });

    expect(await cache.deleteByPrefix('price:')).toBe(450);

    expect(await cache.get(price('sku-7'))).toBeUndefined();
    expect(await cache.get(cacheKey<string>('pricing-rule'))).toBe('kept: the prefix ends with a colon');

    expect(await new RedisCache(client, { namespace: `${namespace}-other` }).get(price('sku-1'))).toEqual({
      amount: 1,
    });

    expect(await cache.deleteByPrefix('price:')).toBe(0);
  });

  it('reads a prefix literally, wildcards included', async () => {
    const cache = new RedisCache(client, { namespace: aNamespace() });

    await cache.set(cacheKey<number>('a*b', '1'), 1);
    await cache.set(cacheKey<number>('a-b', '1'), 2);
    await cache.set(cacheKey<number>('q[1]?', '1'), 3);

    expect(await cache.deleteByPrefix('a*')).toBe(1);
    expect(await cache.deleteByPrefix('q[1]?')).toBe(1);

    expect(await cache.get(cacheKey<number>('a-b', '1'))).toBe(2);
  });

  it('serializes through the codec it is given', async () => {
    const namespace = aNamespace();

    const dated: CacheCodec = {
      encode: (value) => JSON.stringify(value),
      decode: (text) => JSON.parse(text, (key, value) => (key === 'at' ? new Date(value) : value)),
    };

    const cache = new RedisCache(client, { namespace, codec: dated });
    const key = cacheKey<{ at: Date }>('visit');

    await cache.set(key, { at: new Date('2026-03-01T10:00:00.000Z') });

    expect((await cache.get(key))?.at).toEqual(new Date('2026-03-01T10:00:00.000Z'));
  });

  it('treats an entry it cannot decode as a miss, and counts it', async () => {
    const namespace = aNamespace();
    const metrics = new InMemoryMetrics();
    const cache = new RedisCache(client, { namespace, metrics });

    await client.set(`${namespace}:price:sku-1`, '{not json');

    expect(await cache.get(price('sku-1'))).toBeUndefined();
    expect(metrics.counterValue('cache_errors_total', { operation: 'get', context: namespace })).toBe(1);
  });
});

describe('RedisCache while the server is away', () => {
  it('answers a miss, drops the writes and counts each failure: the application keeps serving', async () => {
    const metrics = new InMemoryMetrics();
    const cache = new RedisCache(connectToNothing(), { namespace: 'billing', metrics });

    expect(await cache.get(price('sku-1'))).toBeUndefined();
    await cache.set(price('sku-1'), { amount: 12 }, { ttlMs: 1_000 });
    await cache.delete(price('sku-1'));
    expect(await cache.deleteByPrefix('price:')).toBe(0);

    expect(metrics.counterValue('cache_errors_total', { context: 'billing', operation: 'get' })).toBe(1);
    expect(metrics.counterValue('cache_errors_total', { context: 'billing', operation: 'set' })).toBe(1);
    expect(metrics.counterValue('cache_errors_total', { context: 'billing', operation: 'delete' })).toBe(2);
  });

  it('still computes what it is asked to load, lock or not', async () => {
    const away = connectToNothing();
    const cache = new RedisCache(away, { lock: new RedisLock(away) });

    expect(await cache.getOrLoad(price('sku-1'), async () => ({ amount: 12 }))).toEqual({ amount: 12 });
  });

  it('lets the failure through when told to throw, and counts it all the same', async () => {
    const metrics = new InMemoryMetrics();
    const cache = new RedisCache(connectToNothing(), { onError: 'throw', metrics });

    await expect(cache.get(price('sku-1'))).rejects.toThrow();
    await expect(cache.set(price('sku-1'), { amount: 12 })).rejects.toThrow();
    await expect(cache.delete(price('sku-1'))).rejects.toThrow();

    expect(metrics.counterValue('cache_errors_total')).toBe(3);
  });
});
