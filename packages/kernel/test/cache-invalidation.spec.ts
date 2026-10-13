import { describe, expect, it } from 'vitest';
import {
  CachePurgeRequest,
  FixedClock,
  FixedExecutionScope,
  InMemoryCacheInvalidation,
  InMemoryCachePurger,
  InMemoryEventBus,
  PublishedCacheInvalidation,
  NoCurrentTenantError,
  PurgingPublisher,
  RepeatedCachePurger,
  SequentialIdGenerator,
  cacheTag,
  executionContext,
  tenantCacheTags,
  type CachePurger,
  type IntegrationEvent,
} from '../src/index.js';

const now = new Date('2026-03-02T09:00:00.000Z');

function invalidationIn(
  tenantId: string | undefined,
  perTenant = true,
): {
  invalidation: PublishedCacheInvalidation;
  bus: InMemoryEventBus;
} {
  const bus = new InMemoryEventBus();

  const context = executionContext({
    correlationId: 'c-1',
    actor: { id: 'ada', type: 'user', roles: [], attributes: {}, ...(tenantId === undefined ? {} : { tenantId }) },
    origin: 'test',
  });

  const invalidation = new PublishedCacheInvalidation({
    publisher: bus,
    ids: new SequentialIdGenerator('purge'),
    clock: new FixedClock(now),
    scope: new FixedExecutionScope(context),
    perTenant,
  });

  return { invalidation, bus };
}

const booked: IntegrationEvent = {
  id: 'evt-1',
  type: 'scheduling.appointment.booked',
  version: 1,
  occurredAt: now.toISOString(),
  payload: { appointmentId: 'a-1' },
};

describe('a cache tag', () => {
  it('names a resource, or every resource of a kind, with no character that separates tags', () => {
    expect(cacheTag('calendar', 'c-1')).toBe('calendar:c-1');
    expect(cacheTag('calendar', 7)).toBe('calendar:7');
    expect(cacheTag('calendar')).toBe('calendar');
    expect(cacheTag('practice', 'a b,c')).toBe('practice:a%20b%2Cc');
  });

  it('is filed under the tenant of the work, when there is one', () => {
    expect(tenantCacheTags(['calendar:c-1', 'calendar'], 'acme')).toEqual(['acme/calendar:c-1', 'acme/calendar']);
    expect(tenantCacheTags(['calendar:c-1'], undefined)).toEqual(['calendar:c-1']);
  });
});

describe('PublishedCacheInvalidation', () => {
  it('publishes one purge request with the tags, once each, under the tenant of the work', async () => {
    const { invalidation, bus } = invalidationIn('acme');

    await invalidation.invalidate([cacheTag('calendar', 'c-1'), cacheTag('calendar', 'c-1'), cacheTag('calendar')]);

    expect(bus.published).toEqual([
      {
        id: 'purge-1',
        type: CachePurgeRequest.type,
        version: 1,
        occurredAt: now.toISOString(),
        payload: { tags: ['acme/calendar:c-1', 'acme/calendar'] },
      },
    ]);
  });

  it('keeps the tags as they are when the application does not file them per tenant', async () => {
    const { invalidation, bus } = invalidationIn('acme', false);

    await invalidation.invalidate([cacheTag('calendar', 'c-1')]);

    expect(bus.published.map((event) => CachePurgeRequest.tagsOf(event))).toEqual([['calendar:c-1']]);
  });

  it('refuses work that names no tenant when the tags are filed per tenant: its purge would meet no answer', async () => {
    const { invalidation, bus } = invalidationIn(undefined);

    await expect(invalidation.invalidate([cacheTag('calendar', 'c-1')])).rejects.toThrow(NoCurrentTenantError);
    expect(bus.published).toEqual([]);
  });

  it('publishes nothing when no tag is named', async () => {
    const { invalidation, bus } = invalidationIn(undefined);

    await invalidation.invalidate([]);

    expect(bus.published).toEqual([]);
  });
});

describe('PurgingPublisher', () => {
  it('hands the purge requests to the purger and every other event to the provider', async () => {
    const purger = new InMemoryCachePurger();
    const broker = new InMemoryEventBus();
    const publisher = new PurgingPublisher(purger, broker);
    const request = CachePurgeRequest.of(['calendar:c-1', 'calendar'], { id: 'p-1', occurredAt: booked.occurredAt });
    const again = CachePurgeRequest.of(['calendar:c-1'], { id: 'p-2', occurredAt: booked.occurredAt });

    purger.store('/calendars/c-1', ['calendar:c-1']);
    await publisher.publish([request, booked, again]);

    expect(purger.purged).toEqual(['calendar:c-1', 'calendar']);
    expect(purger.holds('/calendars/c-1')).toBe(false);
    expect(broker.published).toEqual([booked]);
    expect(publisher.messagingSystem).toBe('in-memory');
  });

  it('fails when the purge fails, so the relay retries the request', async () => {
    const failing: CachePurger = { purge: () => Promise.reject(new Error('cache unreachable')) };
    const broker = new InMemoryEventBus();
    const publisher = new PurgingPublisher(failing, broker);

    await expect(
      publisher.publish([CachePurgeRequest.of(['calendar'], { id: 'p-1', occurredAt: booked.occurredAt })]),
    ).rejects.toThrow('cache unreachable');

    await publisher.publish([booked]);

    expect(broker.published).toEqual([booked]);
  });

  it('reads no tags in an event of another type, or in a request whose payload holds none', () => {
    expect(CachePurgeRequest.tagsOf(booked)).toBeUndefined();
    expect(CachePurgeRequest.tagsOf({ ...booked, type: CachePurgeRequest.type, payload: null })).toBeUndefined();

    expect(
      CachePurgeRequest.tagsOf({ ...booked, type: CachePurgeRequest.type, payload: { tags: 'calendar' } }),
    ).toBeUndefined();

    expect(
      CachePurgeRequest.tagsOf({ ...booked, type: CachePurgeRequest.type, payload: { tags: ['calendar', 7] } }),
    ).toEqual(['calendar']);
  });
});

/** A wait the spec ends when it chooses, as the time between the two purges going by. */
function releasableWait(): { wait: (ms: number) => Promise<void>; waited: number[]; release: () => Promise<void> } {
  const waited: number[] = [];
  let release = (): void => undefined;

  const released = new Promise<void>((resolve) => {
    release = resolve;
  });

  return {
    waited,
    wait: (ms) => {
      waited.push(ms);

      return released;
    },
    release: async () => {
      release();
      await new Promise((resolve) => setImmediate(resolve));
    },
  };
}

describe('RepeatedCachePurger', () => {
  it('purges at once, then the same tags again once the delay went by, for a read that was on its way', async () => {
    const cache = new InMemoryCachePurger();
    const time = releasableWait();
    const purger = new RepeatedCachePurger(cache, { againAfterMs: 2_000, wait: time.wait });

    await purger.purge(['calendar:c-1']);

    expect(cache.purged).toEqual(['calendar:c-1']);
    expect(time.waited).toEqual([2_000]);

    cache.store('/calendars/c-1', ['calendar:c-1']);
    await time.release();

    expect(cache.purged).toEqual(['calendar:c-1', 'calendar:c-1']);
    expect(cache.holds('/calendars/c-1')).toBe(false);
  });

  it('fails as its first purge fails, so the relay retries, and only reports a second one that fails', async () => {
    const failures: string[] = [];
    const time = releasableWait();
    let calls = 0;

    const flaky: CachePurger = {
      purge: async () => {
        calls += 1;

        if (calls !== 2) {
          throw new Error(`purge ${calls} refused`);
        }
      },
    };

    const purger = new RepeatedCachePurger(flaky, {
      againAfterMs: 10,
      wait: time.wait,
      onFailure: (error, tags) => failures.push(`${String(error)} for ${tags.join(' ')}`),
    });

    await expect(purger.purge(['calendar'])).rejects.toThrow('purge 1 refused');
    await purger.purge(['calendar']);
    await time.release();

    expect(failures).toEqual(['Error: purge 3 refused for calendar']);
  });

  it('waits for nothing when no tag was purged', async () => {
    const time = releasableWait();

    await new RepeatedCachePurger(new InMemoryCachePurger(), { againAfterMs: 10, wait: time.wait }).purge([]);

    expect(time.waited).toEqual([]);
  });
});

describe('InMemoryCacheInvalidation', () => {
  it('remembers the tags the use cases asked to purge, for a spec to read', async () => {
    const invalidation = new InMemoryCacheInvalidation();

    await invalidation.invalidate([cacheTag('calendar', 'c-1')]);

    expect(invalidation.invalidated).toEqual(['calendar:c-1']);
  });
});
