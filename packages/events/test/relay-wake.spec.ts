import { describe, expect, it } from 'vitest';
import { FixedClock, InMemoryEventBus } from '@ddd-ts-kit/kernel';
import {
  InMemoryOutboxStore,
  InMemoryRelaySignal,
  OutboxRelay,
  type OutboxRecord,
} from '../src/index.js';
import { at } from './support/events.js';
import { eventually } from './support/eventually.js';
import { GatedPublisher } from './support/gated-publisher.js';
import { invoiceIssuedEvent as event } from './support/invoice-issued-event.js';

const AN_HOUR = 3_600_000;

/** The store, counting how many times the relay came to claim. */
class CountingStore extends InMemoryOutboxStore {
  claims = 0;

  override async claimBatch(limit: number, now: Date): Promise<OutboxRecord[]> {
    this.claims += 1;

    return super.claimBatch(limit, now);
  }
}

describe('InMemoryRelaySignal', () => {
  it('notifies its subscribers until they unsubscribe', () => {
    const signal = new InMemoryRelaySignal();
    let heard = 0;

    const subscription = signal.subscribe(() => {
      heard += 1;
    });

    signal.notify();
    subscription.unsubscribe();
    signal.notify();

    expect(heard).toBe(1);
  });
});

describe('OutboxRelay woken by the store', () => {
  it('publishes at once what is appended, without waiting for its long interval', async () => {
    const signal = new InMemoryRelaySignal();
    const store = new InMemoryOutboxStore({ signal });
    const bus = new InMemoryEventBus();
    const relay = new OutboxRelay({ store, publisher: bus, clock: new FixedClock(at), wakeOn: signal });

    relay.start({ intervalMs: AN_HOUR });

    await store.append([event('evt-1')]);
    await eventually(() => bus.published.length === 1);
    await store.append([event('evt-2')]);
    await eventually(() => bus.published.length === 2);
    await relay.stop();

    expect(bus.published.map((published) => published.id)).toEqual(['evt-1', 'evt-2']);
  });

  it('coalesces a burst of notifications into one queued tick', async () => {
    const signal = new InMemoryRelaySignal();
    const store = new CountingStore({ signal });
    const publisher = new GatedPublisher();
    const relay = new OutboxRelay({ store, publisher, clock: new FixedClock(at), wakeOn: signal });

    await store.append([event('evt-1')]);
    relay.start({ intervalMs: AN_HOUR });
    await publisher.entered;

    await store.append([event('evt-2')]);
    await store.append([event('evt-3')]);
    await store.append([event('evt-4')]);
    publisher.open();
    await eventually(() => publisher.delivered.length === 4);
    await relay.stop();

    expect(store.claims).toBe(2);
    expect(publisher.delivered).toEqual(['evt-1', 'evt-2', 'evt-3', 'evt-4']);
  });

  it('keeps polling as the safety net when a notification is missed', async () => {
    const signal = new InMemoryRelaySignal();
    const silentStore = new InMemoryOutboxStore();
    const bus = new InMemoryEventBus();

    const relay = new OutboxRelay({
      store: silentStore,
      publisher: bus,
      clock: new FixedClock(at),
      wakeOn: signal,
    });

    relay.start({ intervalMs: 10 });

    await silentStore.append([event('evt-1')]);
    await eventually(() => bus.published.length === 1);
    await relay.stop();

    expect(await silentStore.stats()).toEqual({ pending: 0, failed: 0, dead: 0 });
  });

  it('no longer listens once stopped', async () => {
    const signal = new InMemoryRelaySignal();
    const store = new CountingStore({ signal });

    const relay = new OutboxRelay({
      store,
      publisher: new InMemoryEventBus(),
      clock: new FixedClock(at),
      wakeOn: signal,
    });

    relay.start({ intervalMs: AN_HOUR });
    await relay.stop();
    const claimsWhenStopped = store.claims;

    await store.append([event('evt-1')]);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(store.claims).toBe(claimsWhenStopped);
    expect(await store.stats()).toEqual({ pending: 1, failed: 0, dead: 0 });
  });
});
