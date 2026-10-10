import { describe, expect, it } from 'vitest';
import { invoiceIssuedEvent as event } from './support/invoice-issued-event.js';
import { setupRelay } from './support/setup-relay.js';

describe('OutboxRelay.tick when the provider refuses an event', () => {
  it('keeps publishing the other events when one fails, so order is not preserved', async () => {
    const { clock, store, publisher, relay } = setupRelay({ 'evt-1': 1 });

    await store.append([event('evt-1'), event('evt-2')]);

    expect(await relay.tick()).toEqual({ published: 1, failed: 1 });
    expect(await store.stats()).toEqual({ pending: 1, failed: 1, dead: 0 });

    clock.advance(1_000);
    expect(await relay.tick()).toEqual({ published: 1, failed: 0 });
    expect(publisher.delivered).toEqual(['evt-2', 'evt-1']);
  });

  it('retries with an exponential backoff capped at maxMs', async () => {
    const { clock, store, relay } = setupRelay({ 'evt-1': 10 }, 10);

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
    const { clock, store, publisher, relay, reported } = setupRelay({ 'evt-1': 99 }, 3);

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
    const { clock, store, publisher, relay } = setupRelay({ 'evt-1': 1 }, 1);

    await store.append([event('evt-1')]);
    await relay.tick();

    expect(await store.retryDead(['evt-1', 'unknown'], clock.now())).toBe(1);

    expect(await relay.tick()).toEqual({ published: 1, failed: 0 });
    expect(publisher.delivered).toEqual(['evt-1']);
  });

  it('stores and reports a code, never the message of the caught error', async () => {
    const { store, relay, reported } = setupRelay({ 'evt-1': 1 });

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
});
