import { describe, expect, it } from 'vitest';
import {
  FixedClock,
  InMemoryEventBus,
  type IntegrationEvent,
  type IntegrationEventPublisher,
} from '@ddd-ts-kit/kernel';
import {
  DuplicateOutboxEventError,
  InMemoryOutboxStore,
  OutboxPublisher,
  OutboxRelay,
  errorCode,
  type OutboxRecord,
  type OutboxRelayFailure,
  type OutboxStore,
} from '../src/index.js';
import { at, invoiceIssued } from './support/events.js';

const event = (id: string): IntegrationEvent =>
  invoiceIssued.create({ invoiceId: `inv-${id}`, orderId: 'order-1' }, { id, occurredAt: at });

class BrokerDown extends Error {
  constructor() {
    super('connection refused to amqp://user:secret@broker');
  }
}

/** A provider that refuses the listed events a given number of times, then accepts them. */
class FlakyPublisher implements IntegrationEventPublisher {
  readonly delivered: string[] = [];
  readonly #remainingFailures: Map<string, number>;

  constructor(failures: Record<string, number> = {}) {
    this.#remainingFailures = new Map(Object.entries(failures));
  }

  async publish(events: readonly IntegrationEvent[]): Promise<void> {
    for (const { id } of events) {
      const remaining = this.#remainingFailures.get(id) ?? 0;
      if (remaining > 0) {
        this.#remainingFailures.set(id, remaining - 1);
        throw new BrokerDown();
      }
      this.delivered.push(id);
    }
  }
}

class StoreUnavailable extends Error {
  constructor() {
    super('password authentication failed for user "app"');
  }
}

/** A store whose first claims fail, as when the database is restarting. */
class UnstableStore implements OutboxStore {
  constructor(
    private readonly inner: OutboxStore,
    private failures: number,
  ) {}

  async claimBatch(limit: number, now: Date): Promise<OutboxRecord[]> {
    if (this.failures > 0) {
      this.failures -= 1;
      throw new StoreUnavailable();
    }
    return this.inner.claimBatch(limit, now);
  }

  append = (events: readonly IntegrationEvent[]) => this.inner.append(events);
  markPublished = (ids: readonly string[], when: Date) => this.inner.markPublished(ids, when);
  markFailed = (id: string, error: { code: string }, next: Date | null) =>
    this.inner.markFailed(id, error, next);
  retryDead = (ids: readonly string[], now: Date) => this.inner.retryDead(ids, now);
  purgePublished = (before: Date) => this.inner.purgePublished(before);
  stats = () => this.inner.stats();
}

const setup = (failures: Record<string, number> = {}, maxAttempts = 3) => {
  const clock = new FixedClock(at);
  const store = new InMemoryOutboxStore({ leaseMs: 60_000 });
  const publisher = new FlakyPublisher(failures);
  const reported: OutboxRelayFailure[] = [];
  const relay = new OutboxRelay({
    store,
    publisher,
    clock,
    maxAttempts,
    backoff: { baseMs: 1_000, factor: 2, maxMs: 3_000 },
    onFailure: (failure) => reported.push(failure),
  });
  return { clock, store, publisher, relay, reported };
};

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

describe('OutboxRelay.tick', () => {
  it('publishes each pending event once', async () => {
    const { store, publisher, relay } = setup();
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

  it('keeps publishing the other events when one fails, so order is not preserved', async () => {
    const { clock, store, publisher, relay } = setup({ 'evt-1': 1 });
    await store.append([event('evt-1'), event('evt-2')]);

    expect(await relay.tick()).toEqual({ published: 1, failed: 1 });
    expect(await store.stats()).toEqual({ pending: 1, failed: 1, dead: 0 });

    clock.advance(1_000);
    expect(await relay.tick()).toEqual({ published: 1, failed: 0 });
    expect(publisher.delivered).toEqual(['evt-2', 'evt-1']);
  });

  it('retries with an exponential backoff capped at maxMs', async () => {
    const { clock, store, relay } = setup({ 'evt-1': 10 }, 10);
    await store.append([event('evt-1')]);
    const nextAttemptIn = async (): Promise<number> => {
      await relay.tick();
      const record = store.records()[0];
      return record === undefined ? -1 : record.nextAttemptAt.getTime() - clock.now().getTime();
    };

    expect(await nextAttemptIn()).toBe(1_000);
    clock.advance(999);
    expect(await relay.tick()).toEqual({ published: 0, failed: 0 });
    clock.advance(1);
    expect(await nextAttemptIn()).toBe(2_000);
    clock.advance(2_000);
    expect(await nextAttemptIn()).toBe(3_000);
    clock.advance(3_000);
    expect(await nextAttemptIn()).toBe(3_000);
  });

  it('declares the record dead after maxAttempts, then leaves it alone', async () => {
    const { clock, store, publisher, relay, reported } = setup({ 'evt-1': 99 }, 3);
    await store.append([event('evt-1')]);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await relay.tick();
      clock.advance(10_000);
    }

    expect(store.records()[0]).toMatchObject({ status: 'dead', attempts: 3 });
    expect(await store.stats()).toEqual({ pending: 0, failed: 0, dead: 1 });
    expect(publisher.delivered).toEqual([]);
    expect(reported.map((failure) => (failure.kind === 'publish' ? failure.dead : undefined))).toEqual(
      [false, false, true],
    );
  });

  it('publishes a dead record again once it is retried', async () => {
    const { clock, store, publisher, relay } = setup({ 'evt-1': 1 }, 1);
    await store.append([event('evt-1')]);
    await relay.tick();

    expect(await store.retryDead(['evt-1', 'unknown'], clock.now())).toBe(1);

    expect(await relay.tick()).toEqual({ published: 1, failed: 0 });
    expect(publisher.delivered).toEqual(['evt-1']);
  });

  it('stores and reports a code, never the message of the caught error', async () => {
    const { store, relay, reported } = setup({ 'evt-1': 1 });
    await store.append([event('evt-1')]);

    await relay.tick();

    expect(store.records()[0]?.lastErrorCode).toBe('BrokerDown');
    expect(reported).toEqual([
      {
        kind: 'publish',
        eventId: 'evt-1',
        eventType: 'billing.invoice.issued',
        code: 'BrokerDown',
        attempts: 1,
        dead: false,
      },
    ]);
    expect(JSON.stringify([store.records(), reported])).not.toContain('secret');
  });

  it('publishes again an event whose relay died before marking it, once the lease expires', async () => {
    const { clock, store, publisher, relay } = setup();
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
    const { clock, store, relay } = setup();
    await store.append([event('evt-1'), event('evt-2')]);
    await relay.tick();
    await store.append([event('evt-3')]);

    expect(await store.purgePublished(clock.now())).toBe(0);
    clock.advance(1);
    expect(await store.purgePublished(clock.now())).toBe(2);
    expect(store.records().map((record) => record.event.id)).toEqual(['evt-3']);
  });
});

describe('errorCode', () => {
  it.each([
    [Object.assign(new Error('boom'), { code: 'ECONNREFUSED' }), 'ECONNREFUSED'],
    [Object.assign(new Error('boom'), { code: 'not a code: it quotes data' }), 'Error'],
    [new BrokerDown(), 'BrokerDown'],
    [new AggregateError([], 'two handlers failed'), 'AggregateError'],
    ['a thrown string', 'UNKNOWN_ERROR'],
    [{ message: 'not an error' }, 'UNKNOWN_ERROR'],
    [undefined, 'UNKNOWN_ERROR'],
  ])('reduces %o to an identifier', (error, code) => {
    expect(errorCode(error)).toBe(code);
  });
});

describe('OutboxRelay.start and stop', () => {
  const until = async (condition: () => boolean): Promise<void> => {
    const deadline = Date.now() + 2_000;
    while (!condition() && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
  };

  it('relays in the background until stopped', async () => {
    const { store, publisher, relay } = setup();
    await store.append([event('evt-1')]);

    relay.start({ intervalMs: 2 });
    relay.start({ intervalMs: 2 });
    await until(() => publisher.delivered.length === 1);
    await store.append([event('evt-2')]);
    await until(() => publisher.delivered.length === 2);
    await relay.stop();

    await store.append([event('evt-3')]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(publisher.delivered).toEqual(['evt-1', 'evt-2']);
  });

  it('waits for the tick in progress before stop resolves', async () => {
    const store = new InMemoryOutboxStore();
    const delivered: string[] = [];
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const slow: IntegrationEventPublisher = {
      async publish(events) {
        await gate;
        delivered.push(...events.map((published) => published.id));
      },
    };
    const relay = new OutboxRelay({ store, publisher: slow, clock: new FixedClock(at) });
    await store.append([event('evt-1')]);

    relay.start({ intervalMs: 1_000 });
    let stopped = false;
    const stopping = relay.stop().then(() => {
      stopped = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(stopped).toBe(false);

    release();
    await stopping;
    expect(delivered).toEqual(['evt-1']);
    expect(store.records()[0]?.status).toBe('published');
  });

  it('survives a store failure and reports its code', async () => {
    const reported: OutboxRelayFailure[] = [];
    const store = new InMemoryOutboxStore();
    const unstable = new UnstableStore(store, 2);
    const publisher = new FlakyPublisher();
    const relay = new OutboxRelay({
      store: unstable,
      publisher,
      clock: new FixedClock(at),
      onFailure: (failure) => reported.push(failure),
    });
    await store.append([event('evt-1')]);

    relay.start({ intervalMs: 2 });
    await until(() => publisher.delivered.length === 1);
    await relay.stop();

    expect(publisher.delivered).toEqual(['evt-1']);
    expect(reported).toEqual([
      { kind: 'tick', code: 'StoreUnavailable' },
      { kind: 'tick', code: 'StoreUnavailable' },
    ]);
  });
});
