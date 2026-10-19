import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NatsEventBus } from '../src/index.js';
import type { Broker } from './support/broker.js';
import { BROKERS } from './support/brokers.js';
import { MAX_ATTEMPTS } from './support/environment.js';
import { PLACED, anEvent } from './support/events.js';
import { failuresOf } from './support/hooks.js';
import { recorder } from './support/recorder.js';
import { eventually } from './support/waiting.js';
import type { NatsFailure } from '../src/index.js';
import { unique } from './support/unique.js';

describe.each(BROKERS)('NatsEventBus: topology, %s', { timeout: 30_000 }, (_name, connect) => {
  let broker: Broker;

  beforeEach(async () => {
    broker = await connect();
  });

  afterEach(async () => {
    await broker.dispose();
  });

  it('describes what it creates, as data', () => {
    const bus = new NatsEventBus({ connection: broker.url, stream: 'shop-events', consumer: 'billing.eu' });

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

  it('keeps a stream that exists with other limits, and works on it', async () => {
    await broker.declareStream([`${broker.subjectPrefix}.>`], { max_msgs: 1_000 });
    const bus = broker.bus();
    const billing = recorder();

    bus.subscribe(PLACED, billing.handler);
    await bus.publish([anEvent('evt-1')]);
    await broker.settled(bus);

    expect(billing.ids()).toEqual(['evt-1']);
  });

  it('cannot connect while its stream refuses one more consumer, and says why', async () => {
    await broker.declareStream([`${broker.subjectPrefix}.>`], { max_consumers: 1 });
    const reported: NatsFailure[] = [];
    const bus = broker.bus({ onFailure: failuresOf(reported) });

    bus.subscribe(PLACED, async () => undefined);
    bus.subscribe('ordering.order.cancelled', async () => undefined);

    await expect(bus.publish([anEvent('evt-1')])).rejects.toMatchObject({
      code: 'BROKER_UNAVAILABLE',
      reason: 'JETSTREAM_10026',
    });

    await expect(bus.publish([anEvent('evt-2')])).rejects.toMatchObject({
      code: 'BROKER_UNAVAILABLE',
      reason: 'RECONNECTING',
    });

    expect(reported[0]).toEqual({ kind: 'connection', code: 'JETSTREAM_10026' });
  });

  it('starts again when its stream is gone for a subscription made once connected', async () => {
    const reported: NatsFailure[] = [];
    const bus = broker.bus({ onFailure: failuresOf(reported) });
    const billing = recorder();

    await bus.assertTopology();
    await broker.deleteStream(broker.stream);
    bus.subscribe(PLACED, billing.handler);
    await eventually(() => reported.some((failure) => failure.code === 'JETSTREAM_10059'));

    await eventually(() =>
      bus.assertTopology().then(
        () => true,
        () => false,
      ),
    );

    await bus.publish([anEvent('evt-1')]);
    await broker.settled(bus);

    expect(billing.ids()).toEqual(['evt-1']);
    expect(reported).toContainEqual({ kind: 'connection', code: 'CONNECTION_CLOSED' });
  });
});
