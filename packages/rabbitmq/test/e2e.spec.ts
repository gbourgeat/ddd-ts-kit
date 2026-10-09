import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  SystemClock,
  err,
  ok,
  type IntegrationEvent,
  type IntegrationEventPublisher,
  type ProcessedEventStore,
  type UnitOfWork,
} from '@ddd-ts-kit/kernel';
import {
  InMemoryOutboxStore,
  InMemoryRelaySignal,
  OutboxPublisher,
  OutboxRelay,
  consume,
  defineIntegrationEvent,
  subscribeAll,
  type OutboxRelayFailure,
} from '@ddd-ts-kit/events';
import type { RabbitMqFailure } from '../src/index.js';
import { AMQP_URL, Broker, eventually, failuresOf, unique } from './support/broker.js';

const orderPlaced = defineIntegrationEvent({
  type: 'ordering.order.placed',
  version: 1,
  payload: {
    parse: (input: unknown) =>
      typeof input === 'object' && input !== null && 'orderId' in input && typeof input.orderId === 'string'
        ? ok({ orderId: input.orderId })
        : err([{ path: 'orderId', code: 'invalid', message: 'orderId must be a string' }]),
    toJsonSchema: () => ({ type: 'object' }),
  },
});

/** The ordering context: a state change and its event, stored together. */
class Ordering {
  readonly orders: string[] = [];
  #events = 0;

  constructor(private readonly publisher: IntegrationEventPublisher) {}

  async placeOrder(orderId: string): Promise<void> {
    this.orders.push(orderId);
    this.#events += 1;
    const meta = { id: `evt-${String(this.#events)}`, occurredAt: new Date() };
    await this.publisher.publish([orderPlaced.create({ orderId }, meta)]);
  }
}

class ConfirmationLost extends Error {
  readonly code = 'CONFIRMATION_LOST';
}

/** The broker takes the first publication, but the relay never learns it: it must retry. */
class LosingTheFirstConfirmation implements IntegrationEventPublisher {
  #lost = false;

  constructor(private readonly inner: IntegrationEventPublisher) {}

  async publish(events: readonly IntegrationEvent[]): Promise<void> {
    await this.inner.publish(events);
    if (!this.#lost) {
      this.#lost = true;
      throw new ConfirmationLost();
    }
  }
}

interface BillingState {
  readonly invoicedOrders: string[];
  readonly processed: Set<string>;
}

/** The database of billing in miniature: a failed unit of work leaves nothing behind. */
class BillingDatabase implements UnitOfWork, ProcessedEventStore {
  #committed: BillingState = { invoicedOrders: [], processed: new Set() };
  #working: BillingState | undefined;

  async run<T>(work: () => Promise<T>): Promise<T> {
    this.#working = {
      invoicedOrders: [...this.#committed.invoicedOrders],
      processed: new Set(this.#committed.processed),
    };
    try {
      const result = await work();
      this.#committed = this.#working;
      return result;
    } finally {
      this.#working = undefined;
    }
  }

  async markProcessed(consumer: string, eventId: string): Promise<boolean> {
    const { processed } = this.#state();
    const key = JSON.stringify([consumer, eventId]);
    if (processed.has(key)) {
      return false;
    }
    processed.add(key);
    return true;
  }

  invoice(orderId: string): void {
    this.#state().invoicedOrders.push(orderId);
  }

  invoicedOrders(): string[] {
    return [...this.#committed.invoicedOrders];
  }

  #state(): BillingState {
    return this.#working ?? this.#committed;
  }
}

class PaymentProviderDown extends Error {
  readonly code = 'PAYMENT_PROVIDER_DOWN';
}

describe.skipIf(AMQP_URL === undefined)('outbox, relay, RabbitMQ and an idempotent consumer', { timeout: 30_000 }, () => {
  let broker: Broker;

  beforeEach(async () => {
    broker = await Broker.connect(AMQP_URL ?? '');
  });

  afterEach(async () => {
    await broker.dispose();
  });

  it('has each order invoiced exactly once despite a relay retry and a redelivery', async () => {
    const exchange = unique('test-events');
    const relayFailures: OutboxRelayFailure[] = [];
    const busFailures: RabbitMqFailure[] = [];
    const signal = new InMemoryRelaySignal();
    const outbox = new InMemoryOutboxStore({ signal });
    const ordering = new Ordering(new OutboxPublisher(outbox));
    const producerBus = broker.bus({ exchange });
    const relay = new OutboxRelay({
      store: outbox,
      publisher: new LosingTheFirstConfirmation(producerBus),
      clock: new SystemClock(),
      backoff: { baseMs: 20 },
      wakeOn: signal,
      onFailure: (failure) => relayFailures.push(failure),
    });

    const billingBus = broker.bus({
      exchange,
      consumer: unique('billing'),
      prefetch: 1,
      onFailure: failuresOf(busFailures),
    });
    const database = new BillingDatabase();
    const deliveries: string[] = [];
    let providerOutages = 1;
    const subscriptions = subscribeAll(billingBus, [
      consume(orderPlaced, { consumer: 'billing', processed: database, unitOfWork: database }, async (event) => {
        deliveries.push(event.id);
        database.invoice(event.payload.orderId);
        if (providerOutages > 0) {
          providerOutages -= 1;
          throw new PaymentProviderDown();
        }
      }),
    ]);
    const everyDelivery: string[] = [];
    billingBus.subscribe(orderPlaced.type, async (event) => void everyDelivery.push(event.id));
    await billingBus.assertTopology();

    relay.start({ intervalMs: 25 });
    await ordering.placeOrder('order-1');
    await ordering.placeOrder('order-2');
    await ordering.placeOrder('order-3');
    await eventually(async () => (await outbox.stats()).pending === 0);
    await relay.stop();
    await broker.settled(billingBus);
    subscriptions.unsubscribe();

    expect(ordering.orders).toEqual(['order-1', 'order-2', 'order-3']);
    expect(database.invoicedOrders().sort()).toEqual(['order-1', 'order-2', 'order-3']);
    expect(await outbox.stats()).toEqual({ pending: 0, failed: 0, dead: 0 });
    expect(relayFailures).toEqual([
      expect.objectContaining({ kind: 'publish', eventId: 'evt-1', code: 'CONFIRMATION_LOST', dead: false }),
    ]);
    expect(busFailures).toEqual([
      expect.objectContaining({ kind: 'handler', code: 'PAYMENT_PROVIDER_DOWN', attempt: 1, dead: false }),
    ]);
    // Three events, one published twice by the relay, one delivered again after the failure.
    expect(everyDelivery.length).toBeGreaterThanOrEqual(5);
    expect(deliveries.length).toBe(4);
  });
});
