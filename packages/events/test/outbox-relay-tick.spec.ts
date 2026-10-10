import { describe, expect, it } from 'vitest';
import { FixedClock } from '@ddd-ts-kit/kernel';
import { InMemoryOutboxStore, OutboxRelay } from '../src/index.js';
import { at } from './support/events.js';
import { FlakyPublisher } from './support/flaky-publisher.js';
import { invoiceIssuedEvent as event } from './support/invoice-issued-event.js';
import { setupRelay } from './support/setup-relay.js';

describe('OutboxRelay.tick', () => {
  it('publishes each pending event once', async () => {
    const { store, publisher, relay } = setupRelay();

    await store.append([event('evt-1'), event('evt-2')]);

    expect(await relay.tick()).toEqual({ published: 2, failed: 0 });
    expect(await relay.tick()).toEqual({ published: 0, failed: 0 });

    expect(publisher.delivered).toEqual(['evt-1', 'evt-2']);
    expect(store.records().map((record) => record.status)).toEqual(['published', 'published']);
    expect(store.records()[0]?.publishedAt).toEqual(at);
  });

  it('respects the batch size', async () => {
    const store = new InMemoryOutboxStore();
    const publisher = new FlakyPublisher();
    const relay = new OutboxRelay({ store, publisher, clock: new FixedClock(at), batchSize: 2 });

    await store.append([event('evt-1'), event('evt-2'), event('evt-3')]);

    expect(await relay.tick()).toEqual({ published: 2, failed: 0 });
    expect(await relay.tick()).toEqual({ published: 1, failed: 0 });
  });

  it('publishes again an event whose relay died before marking it, once the lease expires', async () => {
    const { clock, store, publisher, relay } = setupRelay();

    await store.append([event('evt-1')]);
    // Another relay claimed the record and crashed: nothing was marked.
    await store.claimBatch(10, clock.now());

    expect(await relay.tick()).toEqual({ published: 0, failed: 0 });
    clock.advance(60_000);
    expect(await relay.tick()).toEqual({ published: 1, failed: 0 });
    expect(publisher.delivered).toEqual(['evt-1']);
    expect(store.records()[0]?.attempts).toBe(2);
  });

  it('drops old published records on demand', async () => {
    const { clock, store, relay } = setupRelay();

    await store.append([event('evt-1'), event('evt-2')]);
    await relay.tick();
    await store.append([event('evt-3')]);

    expect(await store.purgePublished(clock.now())).toBe(0);
    clock.advance(1);
    expect(await store.purgePublished(clock.now())).toBe(2);
    expect(store.records().map((record) => record.event.id)).toEqual(['evt-3']);
  });
});
