import { describe, expect, it } from 'vitest';
import { FixedClock, InMemoryEventBus } from '@ddd-ts-kit/kernel';
import {
  DuplicateOutboxEventError,
  InMemoryOutboxStore,
  OutboxPublisher,
  OutboxRelay,
} from '../src/index.js';
import { at } from './support/events.js';
import { invoiceIssuedEvent as event } from './support/invoice-issued-event.js';

describe('OutboxPublisher', () => {
  it('only stores: nothing reaches the provider before the relay runs', async () => {
    const store = new InMemoryOutboxStore();
    const bus = new InMemoryEventBus();
    const relay = new OutboxRelay({ store, publisher: bus, clock: new FixedClock(at) });

    await new OutboxPublisher(store).publish([event('evt-1'), event('evt-2')]);

    expect(bus.published).toEqual([]);
    expect(await store.stats()).toEqual({ pending: 2, failed: 0, dead: 0 });

    expect(await relay.tick()).toEqual({ published: 2, failed: 0 });
    expect(bus.published).toEqual([event('evt-1'), event('evt-2')]);
  });

  it('refuses an event that is already stored', async () => {
    const store = new InMemoryOutboxStore();

    await store.append([event('evt-1')]);

    await expect(store.append([event('evt-2'), event('evt-1')])).rejects.toBeInstanceOf(
      DuplicateOutboxEventError,
    );

    expect(store.records().map((record) => record.event.id)).toEqual(['evt-1']);
  });
});
