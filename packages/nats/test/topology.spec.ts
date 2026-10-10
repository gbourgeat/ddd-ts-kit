import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NatsEventBus } from '../src/index.js';
import { Broker } from './support/broker.js';
import { MAX_ATTEMPTS, NATS_URL } from './support/environment.js';
import { PLACED } from './support/events.js';
import { unique } from './support/unique.js';

describe.skipIf(NATS_URL === undefined)('NatsEventBus: topology', { timeout: 30_000 }, () => {
  const url = NATS_URL ?? '';
  let broker: Broker;

  beforeEach(async () => {
    broker = await Broker.connect(url);
  });

  afterEach(async () => {
    await broker.dispose();
  });

  it('describes what it creates, as data', () => {
    const bus = new NatsEventBus({ connection: url, stream: 'shop-events', consumer: 'billing.eu' });

    bus.subscribe(PLACED, async () => undefined);
    const kept = { storage: 'file', replicas: 1, duplicateWindowMs: 120_000 };

    expect(bus.describeTopology()).toEqual({
      streams: [
        { name: 'shop-events', role: 'events', subjects: ['events.>'], ...kept },
        { name: 'shop-events-dead', role: 'dead', subjects: ['dead.events.>'], ...kept },
      ],
      consumers: [
        {
          stream: 'shop-events',
          name: 'billing_eu_ordering_order_placed',
          filterSubject: 'events.ordering.order.placed',
          ackWaitMs: 30_000,
          maxDeliver: 10,
        },
      ],
    });
  });

  it('creates it idempotently, and gives an existing consumer the limits of the bus', async () => {
    const consumer = unique('billing');
    const bus = broker.bus({ consumer });

    bus.subscribe(PLACED, async () => undefined);
    const { durable } = broker.namesOf({ consumer, type: PLACED });

    await bus.assertTopology();
    await bus.assertTopology();
    expect(await broker.maxDeliverOf(durable)).toBe(MAX_ATTEMPTS * 2);
    await bus.close();
    const patient = broker.bus({ consumer, retry: { maxAttempts: 7 } });

    patient.subscribe(PLACED, async () => undefined);
    await patient.assertTopology();

    expect(await broker.maxDeliverOf(durable)).toBe(14);
    expect(await broker.waitingFor(durable)).toBe(0);
  });
});
