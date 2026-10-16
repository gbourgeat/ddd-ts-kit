import { afterEach, describe, expect, it } from 'vitest';
import { InMemoryOutboxStore, OutboxPublisher, OutboxRelay } from '@ddd-ts-kit/events';
import {
  InMemoryEventBus,
  SystemClock,
  type IntegrationEvent,
  type IntegrationEventPublisher,
} from '@ddd-ts-kit/kernel';
import { settled } from '../src/e2e.js';

const invoiceIssued: IntegrationEvent = {
  id: 'event-invoice-1',
  type: 'billing.invoice.issued',
  version: 1,
  occurredAt: '2026-01-01T00:00:00.000Z',
  payload: { invoiceId: 'invoice-1' },
};

const reminderScheduled: IntegrationEvent = {
  id: 'event-reminder-1',
  type: 'billing.reminder.scheduled',
  version: 1,
  occurredAt: '2026-01-01T00:00:00.000Z',
  payload: { invoiceId: 'invoice-1' },
};

const running: OutboxRelay[] = [];

afterEach(async () => {
  await Promise.all(running.splice(0).map((relay) => relay.stop()));
});

/** An outbox relayed to the in-memory bus, as the end-to-end support of a generated project starts it. */
function relayedOutbox(publisher: IntegrationEventPublisher) {
  const store = new InMemoryOutboxStore();
  const relay = new OutboxRelay({ store, publisher, clock: new SystemClock(), backoff: { baseMs: 60_000 } });
  const outbox = (): ReturnType<typeof store.stats> => store.stats();

  relay.start({ intervalMs: 20 });
  running.push(relay);

  return { store, outbox };
}

describe('settled', () => {
  it('resolves at once when no source holds work', async () => {
    await expect(settled({ outbox: () => 0 })).resolves.toBeUndefined();
    await expect(settled({})).resolves.toBeUndefined();
  });

  it('resolves once the outbox is relayed, the events its handlers stored on the way included', async () => {
    const bus = new InMemoryEventBus();
    const { store, outbox } = relayedOutbox(bus);

    bus.subscribe(invoiceIssued.type, () => new OutboxPublisher(store).publish([reminderScheduled]));

    await new OutboxPublisher(store).publish([invoiceIssued]);
    await settled({ outbox });

    expect(bus.published.map((event) => event.type)).toEqual([invoiceIssued.type, reminderScheduled.type]);
  });

  it('fails when the time is up, naming each source still pending and how much', async () => {
    const down = { publish: () => Promise.reject(new Error('The broker is down.')) };
    const { store, outbox } = relayedOutbox(down);

    await new OutboxPublisher(store).publish([invoiceIssued, reminderScheduled]);

    await expect(settled({ outbox, jobs: () => 0, mails: async () => 1 }, { timeoutMs: 60 })).rejects.toThrow(
      'Still pending after 60 ms: outbox: 2 (2 failed, waiting for a retry), mails: 1',
    );
  });

  it('fails with what a source threw while counting', async () => {
    const unreachable = (): Promise<number> => Promise.reject(new Error('The store is unreachable.'));

    await expect(settled({ outbox: unreachable })).rejects.toThrow('The store is unreachable.');
  });
});
