import { describe, expect, it } from 'vitest';
import {
  CachePurgeRequest,
  FixedClock,
  FixedExecutionScope,
  InMemoryCacheInvalidation,
  InMemoryCachePurger,
  InMemoryEventBus,
  PublishedCacheInvalidation,
  PurgingPublisher,
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

describe('InMemoryCacheInvalidation', () => {
  it('remembers the tags the use cases asked to purge, for a spec to read', async () => {
    const invalidation = new InMemoryCacheInvalidation();

    await invalidation.invalidate([cacheTag('calendar', 'c-1')]);

    expect(invalidation.invalidated).toEqual(['calendar:c-1']);
  });
});
