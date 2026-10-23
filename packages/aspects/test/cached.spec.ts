import { describe, expect, it } from 'vitest';
import { FixedClock, InMemoryCache, type Cache } from '@ddd-ts-kit/kernel';
import { AspectNotAllowedError, cached, forKinds, forMethods, when, type CachedOptions } from '../src';
import { createAspectFakes, withAspectRuntime } from '../src/testing';
import { QuoteGateway } from './support/quote-gateway';
import { SlowGateway } from './support/slow-gateway';
import { Unreachable } from './support/unreachable';

const byFirstArgument: CachedOptions['key'] = (_method, [first]) => (typeof first === 'string' ? first : undefined);

function createCache(): { cache: InMemoryCache; clock: FixedClock } {
  const clock = new FixedClock(new Date('2026-03-01T10:00:00.000Z'));

  return { clock, cache: new InMemoryCache(clock) };
}

describe('cached', () => {
  it('answers a repeated read from the cache until the entry expires', async () => {
    const { cache, clock } = createCache();
    const gateway = cached({ key: byFirstArgument, ttlMs: 60_000, cache })(new QuoteGateway());

    const first = await gateway.quote('EUR-USD');

    await gateway.reprice(1.2);
    const second = await gateway.quote('EUR-USD');

    clock.advance(60_000);
    const third = await gateway.quote('EUR-USD');

    expect([first, second, third].map((quote) => quote.rate)).toEqual([1.08, 1.08, 1.2]);
  });

  it('keeps apart the keys, the methods and the classes', async () => {
    const { cache } = createCache();

    class Lookup {
      async byId(id: string): Promise<string> {
        return `id ${id}`;
      }

      async byName(name: string): Promise<string> {
        return `name ${name}`;
      }
    }

    const lookup = cached({ key: byFirstArgument, ttlMs: 1000, cache })(new Lookup());

    expect([await lookup.byId('a'), await lookup.byId('b'), await lookup.byName('a')]).toEqual([
      'id a',
      'id b',
      'name a',
    ]);
  });

  it('does not cache a call whose key is undefined', async () => {
    const { cache } = createCache();
    const gateway = cached({ key: () => undefined, ttlMs: 60_000, cache })(new QuoteGateway());

    await gateway.quote('EUR-USD');
    await gateway.quote('EUR-USD');

    expect(gateway.calls).toHaveLength(2);
    expect(cache.size).toBe(0);
  });
});

describe('cached, what it keeps and what it shares', () => {
  it('caches an answer that is undefined', async () => {
    const { cache } = createCache();
    let calls = 0;

    class Lookup {
      async find(_id: string): Promise<undefined> {
        calls += 1;

        return undefined;
      }
    }

    const lookup = cached({ key: byFirstArgument, ttlMs: 1000, cache })(new Lookup());

    await lookup.find('a');
    await lookup.find('a');

    expect(calls).toBe(1);
  });

  it('does not cache a failure', async () => {
    const { cache } = createCache();

    const gateway = cached({ key: byFirstArgument, ttlMs: 60_000, cache })(
      new QuoteGateway().failNext(new Unreachable()),
    );

    await expect(gateway.quote('EUR-USD')).rejects.toBeInstanceOf(Unreachable);

    expect(await gateway.quote('EUR-USD')).toMatchObject({ rate: 1.08 });
  });

  it('makes concurrent identical calls share one underlying call', async () => {
    const { cache } = createCache();
    const gateway = cached({ key: byFirstArgument, ttlMs: 60_000, cache })(new SlowGateway());

    const calls = [gateway.fetch('a'), gateway.fetch('a'), gateway.fetch('b')];

    await new Promise((resolve) => setImmediate(resolve));
    gateway.release('first');
    gateway.release('second');

    expect(await Promise.all(calls)).toEqual(['a:first', 'a:first', 'b:second']);
    expect(gateway.started).toBe(2);
  });
});

describe('cached, where it is allowed and what it falls back on', () => {
  it('refuses to wrap a repository or a use case', () => {
    const aspect = cached({ key: byFirstArgument, ttlMs: 1000 });

    expect(() => aspect(new QuoteGateway(), { kind: 'repository' })).toThrow(AspectNotAllowedError);
    expect(() => aspect(new QuoteGateway(), { kind: 'use-case' })).toThrow(/may be stale/);
    expect(() => aspect(new QuoteGateway(), { kind: 'gateway' })).not.toThrow();
    expect(() => aspect(new QuoteGateway())).not.toThrow();
  });

  it('wraps a refused kind when the decision is written down', () => {
    const aspect = cached({ key: byFirstArgument, ttlMs: 1000, allowKinds: ['repository'] });

    expect(() => aspect(new QuoteGateway(), { kind: 'repository' })).not.toThrow();
    expect(() => aspect(new QuoteGateway(), { kind: 'use-case' })).toThrow(AspectNotAllowedError);
  });

  it('skips what a selector leaves out without refusing it', async () => {
    const { cache } = createCache();

    const reads = when(
      forKinds('gateway', 'external'),
      when(forMethods('quote'), cached({ key: byFirstArgument, ttlMs: 1000, cache })),
    );

    const repository = reads(new QuoteGateway(), { kind: 'repository' });

    await repository.quote('EUR-USD');
    await repository.quote('EUR-USD');

    expect(repository.calls).toHaveLength(2);
  });

  it('takes the cache of the runtime when none is given', async () => {
    const fakes = createAspectFakes();
    const gateway = cached({ key: byFirstArgument, ttlMs: 1000 })(new QuoteGateway());

    await withAspectRuntime(fakes, async () => {
      await gateway.quote('EUR-USD');
      await gateway.quote('EUR-USD');
    });

    expect(gateway.calls).toHaveLength(1);
    expect(fakes.cache.size).toBe(1);
  });

  it('treats a cache that fails as a miss', async () => {
    const down: Cache = {
      get: async () => {
        throw new Unreachable();
      },
      set: async () => {
        throw new Unreachable();
      },
      delete: async () => undefined,
    };

    const gateway = cached({ key: byFirstArgument, ttlMs: 1000, cache: down })(new QuoteGateway());

    expect(await gateway.quote('EUR-USD')).toMatchObject({ rate: 1.08 });
  });
});
