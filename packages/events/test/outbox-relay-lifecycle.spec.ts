import { describe, expect, it } from 'vitest';
import { FixedClock } from '@ddd-ts-kit/kernel';
import { InMemoryOutboxStore, OutboxRelay, type OutboxRelayFailure } from '../src';
import { at } from './support/events';
import { eventually } from './support/eventually';
import { FlakyPublisher } from './support/flaky-publisher';
import { GatedPublisher } from './support/gated-publisher';
import { invoiceIssuedEvent as event } from './support/invoice-issued-event';
import { setupRelay } from './support/setup-relay';
import { UnstableStore } from './support/unstable-store';

describe('OutboxRelay.start and stop', () => {
  it('relays in the background until stopped', async () => {
    const { store, publisher, relay } = setupRelay();

    await store.append([event('evt-1')]);

    relay.start({ intervalMs: 2 });
    relay.start({ intervalMs: 2 });
    await eventually(() => publisher.delivered.length === 1);
    await store.append([event('evt-2')]);
    await eventually(() => publisher.delivered.length === 2);
    await relay.stop();

    await store.append([event('evt-3')]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(publisher.delivered).toEqual(['evt-1', 'evt-2']);
  });

  it('waits for the tick in progress before stop resolves', async () => {
    const store = new InMemoryOutboxStore();
    const slow = new GatedPublisher();
    const relay = new OutboxRelay({ store, publisher: slow, clock: new FixedClock(at) });

    await store.append([event('evt-1')]);

    relay.start({ intervalMs: 1_000 });
    let stopped = false;

    const stopping = relay.stop().then(() => {
      stopped = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(stopped).toBe(false);

    slow.open();
    await stopping;
    expect(slow.delivered).toEqual(['evt-1']);
    expect(store.records()[0]?.status).toBe('published');
  });

  it('survives a store failure and reports its code', async () => {
    const reported: OutboxRelayFailure[] = [];
    const store = new InMemoryOutboxStore();
    const publisher = new FlakyPublisher();

    const relay = new OutboxRelay({
      store: new UnstableStore(store, 2),
      publisher,
      clock: new FixedClock(at),
      onFailure: (failure) => reported.push(failure),
    });

    await store.append([event('evt-1')]);

    relay.start({ intervalMs: 2 });
    await eventually(() => publisher.delivered.length === 1);
    await relay.stop();

    expect(publisher.delivered).toEqual(['evt-1']);

    expect(reported).toEqual([
      { kind: 'tick', code: 'StoreUnavailable' },
      { kind: 'tick', code: 'StoreUnavailable' },
    ]);
  });
});
