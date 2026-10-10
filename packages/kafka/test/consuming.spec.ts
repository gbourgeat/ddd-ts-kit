import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { KafkaEventBus } from '../src/index.js';
import { Broker } from './support/broker.js';
import { KAFKA_BROKERS } from './support/environment.js';
import { PLACED, TRACEPARENT, anEvent } from './support/events.js';
import { recorder } from './support/recorder.js';
import { eventually } from './support/waiting.js';

describe.skipIf(KAFKA_BROKERS === undefined)('KafkaEventBus: consuming', { timeout: 60_000 }, () => {
  const brokers = KAFKA_BROKERS ?? '';
  let broker: Broker;

  beforeEach(async () => {
    broker = await Broker.connect(brokers);
  });

  afterEach(async () => {
    await broker.dispose();
  }, 30_000);

  it('needs a consumer name', () => {
    const anonymous = new KafkaEventBus({ brokers });

    expect(() => anonymous.subscribe(PLACED, async () => undefined)).toThrow(
      expect.objectContaining({ code: 'CONSUMER_NAME_REQUIRED' }),
    );
  });

  it('carries the envelope to the handler with its trace context untouched', async () => {
    const bus = broker.bus();
    const billing = recorder();

    bus.subscribe(PLACED, billing.handler);
    const event = { ...anEvent('evt-1'), traceparent: TRACEPARENT, correlationId: 'corr-1' };

    await bus.publish([event]);
    await broker.settled(bus);

    expect(billing.received).toEqual([event]);
  });

  it('gives every event to each consumer, and shares them between two instances of one', async () => {
    const billingName = broker.consumer('billing');
    const topics = { partitions: 4 };
    const publisher = broker.bus({ topics });
    const billingA = broker.bus({ topics, consumer: billingName });
    const billingB = broker.bus({ topics, consumer: billingName });
    const shippingBus = broker.bus({ topics });
    const [first, second, shipping] = [recorder(), recorder(), recorder()];

    billingA.subscribe(PLACED, first.handler);
    billingB.subscribe(PLACED, second.handler);
    shippingBus.subscribe(PLACED, shipping.handler);
    await Promise.all([billingA.assertTopology(), billingB.assertTopology(), shippingBus.assertTopology()]);
    await eventually(() => billingA.partitionsAssigned === 2 && billingB.partitionsAssigned === 2);
    const events = Array.from({ length: 20 }, (_, index) => anEvent(`evt-${String(index).padStart(2, '0')}`));

    await publisher.publish(events);
    await Promise.all([billingA, billingB, shippingBus].map((bus) => broker.settled(bus)));

    const everyId = events.map((event) => event.id);

    expect(shipping.ids().sort()).toEqual(everyId);
    expect([...first.ids(), ...second.ids()].sort()).toEqual(everyId);
    expect(first.received.length).toBeGreaterThan(0);
    expect(second.received.length).toBeGreaterThan(0);
  });

  it('serves several consuming contexts with forConsumer, each in its own group', async () => {
    const bus = broker.bus();
    const [billing, shipping] = [recorder(), recorder()];

    bus.forConsumer(broker.consumer('billing')).subscribe(PLACED, billing.handler);
    bus.forConsumer(broker.consumer('shipping')).subscribe(PLACED, shipping.handler);

    await bus.publish([anEvent('evt-1')]);
    await broker.settled(bus);

    expect(billing.ids()).toEqual(['evt-1']);
    expect(shipping.ids()).toEqual(['evt-1']);
    expect(bus.describeTopology().groups).toHaveLength(2);
  });

  it('skips the types it did not subscribe to on a topic that carries several', async () => {
    const topicOf = (): string => broker.topicOf('ordering');
    const bus = broker.bus({ topicOf });
    const billing = recorder();

    bus.subscribe(PLACED, billing.handler);

    await bus.publish([anEvent('evt-1', 'ordering.order.cancelled'), anEvent('evt-2')]);
    await broker.settled(bus);

    expect(billing.ids()).toEqual(['evt-2']);
    expect(await broker.countIn(broker.topicOf('ordering'))).toBe(2);
  });
});
