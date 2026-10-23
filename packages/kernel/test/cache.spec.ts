import { describe, expect, it } from 'vitest';
import { FixedClock, InMemoryCache, cacheKey } from '../src';

interface Quote {
  readonly pair: string;
  readonly rate: number;
}

const quoteKey = (pair: string) => cacheKey<Quote>('quote', pair);

function createCache(maxEntries?: number): { cache: InMemoryCache; clock: FixedClock } {
  const clock = new FixedClock(new Date('2026-03-01T10:00:00.000Z'));

  return { clock, cache: new InMemoryCache(clock, maxEntries === undefined ? {} : { maxEntries }) };
}

describe('cacheKey', () => {
  it('joins its segments into one name', () => {
    expect(quoteKey('EUR-USD').name).toBe('quote:EUR-USD');
  });
});

describe('InMemoryCache', () => {
  it('answers what was stored under the key, typed by the key', async () => {
    const { cache } = createCache();

    await cache.set(quoteKey('EUR-USD'), { pair: 'EUR-USD', rate: 1.08 });
    const quote: Quote | undefined = await cache.get(quoteKey('EUR-USD'));

    expect(quote).toEqual({ pair: 'EUR-USD', rate: 1.08 });
    expect(await cache.get(quoteKey('EUR-GBP'))).toBeUndefined();
  });

  it('forgets an entry once its time to live has passed', async () => {
    const { cache, clock } = createCache();

    await cache.set(quoteKey('EUR-USD'), { pair: 'EUR-USD', rate: 1.08 }, { ttlMs: 1000 });

    clock.advance(999);
    expect(await cache.get(quoteKey('EUR-USD'))).toBeDefined();
    clock.advance(1);
    expect(await cache.get(quoteKey('EUR-USD'))).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('keeps an entry without time to live until it is deleted', async () => {
    const { cache, clock } = createCache();

    await cache.set(quoteKey('EUR-USD'), { pair: 'EUR-USD', rate: 1.08 });

    clock.advance(86_400_000);
    expect(await cache.get(quoteKey('EUR-USD'))).toBeDefined();
    await cache.delete(quoteKey('EUR-USD'));
    expect(await cache.get(quoteKey('EUR-USD'))).toBeUndefined();
  });

  it('replaces the value and the time to live of a key set again', async () => {
    const { cache, clock } = createCache();

    await cache.set(quoteKey('EUR-USD'), { pair: 'EUR-USD', rate: 1.08 }, { ttlMs: 1000 });
    await cache.set(quoteKey('EUR-USD'), { pair: 'EUR-USD', rate: 1.1 });

    clock.advance(5000);

    expect(await cache.get(quoteKey('EUR-USD'))).toEqual({ pair: 'EUR-USD', rate: 1.1 });
  });

  it('drops the oldest entry beyond its capacity', async () => {
    const { cache } = createCache(2);

    for (const pair of ['EUR-USD', 'EUR-GBP', 'EUR-JPY']) {
      await cache.set(quoteKey(pair), { pair, rate: 1 });
    }

    expect(cache.size).toBe(2);
    expect(await cache.get(quoteKey('EUR-USD'))).toBeUndefined();
    expect(await cache.get(quoteKey('EUR-JPY'))).toBeDefined();
  });
});
