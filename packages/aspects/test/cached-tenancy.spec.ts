import { describe, expect, it } from 'vitest';
import {
  AsyncLocalStorageExecutionScope,
  FixedClock,
  InMemoryCache,
  cacheKey,
  executionContext,
  tenantCacheKey,
  type Actor,
} from '@ddd-ts-kit/kernel';
import { cached, type CachedOptions } from '../src';
import { withAspectRuntime } from '../src/testing';

const scope = new AsyncLocalStorageExecutionScope();

function inTenant<T>(tenantId: string | undefined, work: () => T): T {
  const actor: Actor = { id: 'ada', type: 'user', roles: [], attributes: {} };
  const context = executionContext({ correlationId: 'c-1', actor, origin: 'cli' });

  return scope.run(tenantId === undefined ? context : { ...context, tenantId }, work);
}

function elevated<T>(tenantId: string | undefined, work: () => T): T {
  return inTenant(tenantId, () => {
    const context = scope.require();

    return scope.run({ ...context, elevation: { reason: 'SUPPORT_TICKET', tenants: 'all' } }, work);
  });
}

/** Answers what the tenant of the work holds under one id. */
class Hours {
  calls = 0;

  private readonly waiting: (() => void)[] = [];

  held = false;

  async of(id: string): Promise<string> {
    const tenant = scope.current()?.tenantId ?? 'no tenant';

    this.calls += 1;

    if (this.held) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }

    return `${id} of ${tenant}`;
  }

  releaseAll(): void {
    this.waiting.splice(0).forEach((release) => {
      release();
    });
  }
}

const byId: CachedOptions['key'] = (_method, [id]) => String(id);

function arrange(options: Partial<CachedOptions> = {}): { cache: InMemoryCache; hours: Hours; plain: Hours } {
  const cache = new InMemoryCache(new FixedClock(new Date('2026-03-01T10:00:00.000Z')));
  const plain = new Hours();

  return { cache, plain, hours: cached({ key: byId, ttlMs: 60_000, cache, ...options })(plain) };
}

describe('cached, in a multi-tenant application', () => {
  it('never serves one tenant what another read', async () => {
    const { hours, plain } = arrange();

    await withAspectRuntime({ scope }, async () => {
      expect(await inTenant('acme', () => hours.of('p-1'))).toBe('p-1 of acme');
      expect(await inTenant('globex', () => hours.of('p-1'))).toBe('p-1 of globex');
      expect(await inTenant('acme', () => hours.of('p-1'))).toBe('p-1 of acme');
    });

    expect(plain.calls).toBe(2);
  });

  it('files the entry under the tenant, as tenantCacheKey does', async () => {
    const { cache, hours } = arrange();

    await withAspectRuntime({ scope }, () => inTenant('acme', () => hours.of('a:b')));

    const key = inTenant('acme', () => tenantCacheKey<unknown>(scope, 'aspect', 'Hours', 'of', 'a:b'));

    expect(await cache.get(key)).toEqual({ value: 'a:b of acme' });
  });

  it('does not make concurrent calls of two tenants share one call', async () => {
    const { hours, plain } = arrange();

    plain.held = true;

    const answers = withAspectRuntime({ scope }, () =>
      Promise.all([
        inTenant('acme', () => hours.of('p-1')),
        inTenant('globex', () => hours.of('p-1')),
        inTenant('acme', () => hours.of('p-1')),
      ]),
    );

    await new Promise((resolve) => setImmediate(resolve));
    plain.releaseAll();

    expect(await answers).toEqual(['p-1 of acme', 'p-1 of globex', 'p-1 of acme']);
    expect(plain.calls).toBe(2);
  });

  it('keeps one entry for every tenant when the caller says shared', async () => {
    const { cache, hours, plain } = arrange({ shared: true });

    await withAspectRuntime({ scope }, async () => {
      expect(await inTenant('acme', () => hours.of('p-1'))).toBe('p-1 of acme');
      expect(await inTenant('globex', () => hours.of('p-1'))).toBe('p-1 of acme');
    });

    expect(plain.calls).toBe(1);
    expect(await cache.get(cacheKey<unknown>('aspect', 'Hours', 'of', 'p-1'))).toEqual({ value: 'p-1 of acme' });
  });

  it('keeps the key as written for work that names no tenant', async () => {
    const { cache, hours } = arrange();

    await withAspectRuntime({ scope }, async () => {
      await inTenant(undefined, () => hours.of('in-a-global-job'));
      await hours.of('outside-any-scope');
    });

    expect(await cache.get(cacheKey<unknown>('aspect', 'Hours', 'of', 'in-a-global-job'))).toBeDefined();
    expect(await cache.get(cacheKey<unknown>('aspect', 'Hours', 'of', 'outside-any-scope'))).toBeDefined();
  });

  it('never serves a tenant what work without a tenant cached', async () => {
    const { hours, plain } = arrange();

    await withAspectRuntime({ scope }, async () => {
      expect(await inTenant(undefined, () => hours.of('p-1'))).toBe('p-1 of no tenant');
      expect(await inTenant('acme', () => hours.of('p-1'))).toBe('p-1 of acme');
    });

    expect(plain.calls).toBe(2);
  });

  it.each([
    ['in a tenant', 'acme', {}],
    ['outside any tenant', undefined, {}],
    ['on a shared read', 'acme', { shared: true }],
  ])(
    'runs the call under an elevation, %s: it neither reads nor writes the cache',
    async (_where, tenantId, options) => {
      const { cache, hours, plain } = arrange(options);

      await withAspectRuntime({ scope }, async () => {
        await inTenant(tenantId, () => hours.of('p-1'));
        await elevated(tenantId, () => hours.of('p-1'));
        await elevated(tenantId, () => hours.of('p-1'));
      });

      expect(plain.calls).toBe(3);
      expect(cache.size).toBe(1);
    },
  );

  it('keeps the key as written on a runtime that has no execution scope', async () => {
    const { cache, hours } = arrange();

    await withAspectRuntime({}, () => inTenant('acme', () => hours.of('p-1')));

    expect(await cache.get(cacheKey<unknown>('aspect', 'Hours', 'of', 'p-1'))).toBeDefined();
  });
});
