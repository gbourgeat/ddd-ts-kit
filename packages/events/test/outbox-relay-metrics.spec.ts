import { FixedClock, InMemoryMetrics } from '@ddd-ts-kit/kernel';
import { describe, expect, it } from 'vitest';
import { InMemoryOutboxStore, OutboxRelay, type OutboxStats } from '../src';
import { at } from './support/events';
import { FlakyPublisher } from './support/flaky-publisher';
import { invoiceIssuedEvent as event } from './support/invoice-issued-event';

/** A store that cannot count: a relay that asked it would fail its tick. */
class StoreWithoutStats extends InMemoryOutboxStore {
  override stats(): Promise<OutboxStats> {
    return Promise.reject(new Error('stats asked'));
  }
}

function depthOf(metrics: InMemoryMetrics): Record<string, number | undefined> {
  return {
    pending: metrics.gaugeValue('outbox_pending'),
    failed: metrics.gaugeValue('outbox_failed'),
    dead: metrics.gaugeValue('outbox_dead'),
  };
}

describe('OutboxRelay, given metrics', () => {
  it('sets the depth of the store as gauges after each tick', async () => {
    const clock = new FixedClock(at);
    const store = new InMemoryOutboxStore();
    const metrics = new InMemoryMetrics();
    const publisher = new FlakyPublisher({ 'evt-retried': 1, 'evt-dead': 5 });

    const relay = new OutboxRelay({
      store,
      publisher,
      clock,
      maxAttempts: 2,
      backoff: { baseMs: 1_000, factor: 1, maxMs: 1_000 },
      metrics,
    });

    await store.append([event('evt-sent'), event('evt-retried'), event('evt-dead')]);

    await relay.tick();
    expect(depthOf(metrics)).toEqual({ pending: 2, failed: 2, dead: 0 });

    clock.advance(1_000);
    await relay.tick();
    expect(depthOf(metrics)).toEqual({ pending: 0, failed: 0, dead: 1 });
  });

  it('does not ask the store to count without them', async () => {
    const relay = new OutboxRelay({
      store: new StoreWithoutStats(),
      publisher: new FlakyPublisher(),
      clock: new FixedClock(at),
    });

    expect(await relay.tick()).toEqual({ published: 0, failed: 0 });
  });
});
