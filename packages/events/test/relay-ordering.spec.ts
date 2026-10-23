import { describe, expect, it } from 'vitest';
import { FixedClock, type IntegrationEvent } from '@ddd-ts-kit/kernel';
import {
  HELD_FOR_ORDER,
  InMemoryOutboxStore,
  OutboxRelay,
  type OutboxOrdering,
  type OutboxRecord,
  type OutboxRelayFailure,
} from '../src';
import { at, invoiceIssued } from './support/events';
import { RecoveringPublisher } from './support/recovering-publisher';

/** `a-1` is the first event of order `a`: the id says the key and the position. */
const event = (id: string): IntegrationEvent =>
  invoiceIssued.create({ invoiceId: `inv-${id}`, orderId: id.slice(0, id.indexOf('-')) }, { id, occurredAt: at });

const orderIdOf = (published: IntegrationEvent): string | undefined =>
  invoiceIssued.is(published) ? published.payload.orderId : undefined;

const RETRY_MS = 1_000;

const setup = (failures: Record<string, number>, ordering: OutboxOrdering = 'per-key') => {
  const clock = new FixedClock(at);
  const store = new InMemoryOutboxStore({ leaseMs: 60_000 });
  const publisher = new RecoveringPublisher(failures);
  const reported: OutboxRelayFailure[] = [];

  const relay = new OutboxRelay({
    store,
    publisher,
    clock,
    maxAttempts: 3,
    batchSize: 10,
    backoff: { baseMs: RETRY_MS, factor: 1 },
    ordering,
    keyOf: orderIdOf,
    onFailure: (failure) => reported.push(failure),
  });

  const laterTick = async () => {
    clock.advance(RETRY_MS);

    return relay.tick();
  };

  return { clock, store, publisher, relay, reported, laterTick };
};

class StoreUnavailable extends Error {
  readonly code = 'STORE_UNAVAILABLE';
}

/** A store that cannot record the first failure it is told about, as during a failover. */
class ForgetfulStore extends InMemoryOutboxStore {
  private outages = 1;

  override async markFailed(id: string, error: { readonly code: string }, nextAttemptAt: Date | null): Promise<void> {
    if (this.outages > 0) {
      this.outages -= 1;
      throw new StoreUnavailable();
    }

    await super.markFailed(id, error, nextAttemptAt);
  }
}

const recordOf = (store: InMemoryOutboxStore, id: string): OutboxRecord | undefined =>
  store.records().find((record) => record.event.id === id);

describe('OutboxRelay without ordering', () => {
  it('lets the successors of a failed record overtake it', async () => {
    const { store, publisher, relay, laterTick } = setup({ 'a-1': 1 }, 'none');

    await store.append([event('a-1'), event('a-2')]);

    await relay.tick();
    await laterTick();

    expect(publisher.delivered).toEqual(['a-2', 'a-1']);
  });
});

describe('OutboxRelay with per-key ordering', () => {
  it('holds the successors of a failed record back, and only those of its key', async () => {
    const { store, publisher, relay } = setup({ 'a-1': 2 });

    await store.append([event('a-1'), event('b-1'), event('a-2'), event('a-3')]);

    expect(await relay.tick()).toEqual({ published: 1, failed: 1 });

    expect(publisher.delivered).toEqual(['b-1']);
    expect(recordOf(store, 'a-2')).toMatchObject({ status: 'pending', lastErrorCode: HELD_FOR_ORDER });
  });

  it('publishes the key in order once the failing publisher recovers', async () => {
    const { store, publisher, relay, laterTick } = setup({ 'a-1': 2 });

    await store.append([event('a-1'), event('b-1'), event('a-2'), event('a-3')]);

    await relay.tick();
    expect(await laterTick()).toEqual({ published: 0, failed: 1 });
    expect(await laterTick()).toEqual({ published: 3, failed: 0 });

    expect(publisher.delivered).toEqual(['b-1', 'a-1', 'a-2', 'a-3']);
    expect(await store.stats()).toEqual({ pending: 0, failed: 0, dead: 0 });
  });

  it('holds back a record appended while the head of its key waits for its retry', async () => {
    const { store, publisher, relay, laterTick } = setup({ 'a-1': 1 });

    await store.append([event('a-1'), event('a-2')]);
    await relay.tick();

    await store.append([event('a-3'), event('b-1')]);
    await relay.tick();
    expect(publisher.delivered).toEqual(['b-1']);
    await laterTick();

    expect(publisher.delivered).toEqual(['b-1', 'a-1', 'a-2', 'a-3']);
  });

  it('keeps the order when a successor fails in its turn', async () => {
    const { store, publisher, relay, laterTick } = setup({ 'a-1': 1, 'a-2': 1 });

    await store.append([event('a-1'), event('a-2'), event('a-3')]);

    await relay.tick();
    await laterTick();
    expect(publisher.delivered).toEqual(['a-1']);
    await laterTick();

    expect(publisher.delivered).toEqual(['a-1', 'a-2', 'a-3']);
  });

  it('does not count the claims spent waiting as delivery attempts', async () => {
    const { store, publisher, relay, reported, laterTick } = setup({ 'a-1': 2, 'a-2': 2 });

    await store.append([event('a-1'), event('a-2')]);

    await relay.tick();
    await laterTick();
    await laterTick();
    await laterTick();
    await laterTick();

    expect(publisher.delivered).toEqual(['a-1', 'a-2']);
    expect(reported.filter((failure) => failure.kind === 'publish' && failure.dead)).toEqual([]);
    expect(await store.stats()).toEqual({ pending: 0, failed: 0, dead: 0 });
  });

  it('leaves events without a key unordered', async () => {
    const { store, publisher, relay } = setup({ 'evt-1': 1 });
    const unkeyed = (id: string): IntegrationEvent => ({ ...event('x-1'), id, type: 'legacy.thing.happened' });

    await store.append([unkeyed('evt-1'), unkeyed('evt-2')]);

    await relay.tick();

    expect(publisher.delivered).toEqual(['evt-2']);
  });
});

describe('OutboxRelay with per-key ordering, when the head of a key goes away', () => {
  it('stops blocking the key once its head is dead', async () => {
    const { store, publisher, relay, reported, laterTick } = setup({ 'a-1': 5 });

    await store.append([event('a-1'), event('a-2')]);

    await relay.tick();
    await laterTick();
    await laterTick();

    expect(reported.at(-1)).toMatchObject({ eventId: 'a-1', attempts: 3, dead: true });
    expect(publisher.delivered).toEqual(['a-2']);
    expect(await store.stats()).toEqual({ pending: 0, failed: 0, dead: 1 });
  });

  it('releases a key whose head left the queue by another way', async () => {
    const { store, publisher, relay, laterTick } = setup({ 'a-1': 5 });

    await store.append([event('a-1'), event('a-2')]);
    await relay.tick();

    await store.markPublished(['a-1'], at);
    await laterTick();

    expect(publisher.delivered).toEqual(['a-2']);
  });

  it('waits for a record whose fate is unknown after an aborted tick', async () => {
    const clock = new FixedClock(at);
    const store = new ForgetfulStore({ leaseMs: 60_000 });
    const publisher = new RecoveringPublisher({ 'a-1': 1 });
    const relay = new OutboxRelay({ store, publisher, clock, ordering: 'per-key', keyOf: orderIdOf });

    await store.append([event('a-1')]);
    await expect(relay.tick()).rejects.toBeInstanceOf(StoreUnavailable);

    await store.append([event('a-2')]);
    await relay.tick();
    expect(publisher.delivered).toEqual([]);
    clock.advance(60_000);
    await relay.tick();

    expect(publisher.delivered).toEqual(['a-1', 'a-2']);
  });
});
