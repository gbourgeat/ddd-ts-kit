import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RabbitMqEventBus } from '../src/index.js';
import { Broker } from './support/broker.js';
import { AMQP_URL } from './support/environment.js';
import { PLACED, TRACEPARENT, anEvent } from './support/events.js';
import { recorder } from './support/recorder.js';
import { unique } from './support/unique.js';

describe.skipIf(AMQP_URL === undefined)('RabbitMqEventBus: consuming', { timeout: 30_000 }, () => {
  const url = AMQP_URL ?? '';
  let broker: Broker;

  beforeEach(async () => {
    broker = await Broker.connect(url);
  });

  afterEach(async () => {
    await broker.dispose();
  });

  it('needs a consumer name', () => {
    const anonymous = new RabbitMqEventBus({ connection: url });

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
    const exchange = unique('test-events');
    const billingName = unique('billing');
    const publisher = broker.bus({ exchange });
    const billingA = broker.bus({ exchange, consumer: billingName, prefetch: 1 });
    const billingB = broker.bus({ exchange, consumer: billingName, prefetch: 1 });
    const shippingBus = broker.bus({ exchange, consumer: unique('shipping') });
    const [first, second, shipping] = [recorder(), recorder(), recorder()];

    billingA.subscribe(PLACED, first.handler);
    billingB.subscribe(PLACED, second.handler);
    shippingBus.subscribe(PLACED, shipping.handler);
    await Promise.all([billingA.assertTopology(), billingB.assertTopology(), shippingBus.assertTopology()]);
    const events = Array.from({ length: 20 }, (_, index) => anEvent(`evt-${String(index).padStart(2, '0')}`));

    await publisher.publish(events);
    await Promise.all([billingA, billingB, shippingBus].map((bus) => broker.settled(bus)));

    const everyId = events.map((event) => event.id);

    expect(shipping.ids().sort()).toEqual(everyId);
    expect([...first.ids(), ...second.ids()].sort()).toEqual(everyId);
    expect(first.received.length).toBeGreaterThan(0);
    expect(second.received.length).toBeGreaterThan(0);
  });

  it('serves several consuming contexts on one connection with forConsumer', async () => {
    const bus = broker.bus();
    const [billing, shipping] = [recorder(), recorder()];

    bus.forConsumer(unique('billing')).subscribe(PLACED, billing.handler);
    bus.forConsumer(unique('shipping')).subscribe(PLACED, shipping.handler);

    await bus.publish([anEvent('evt-1')]);
    await broker.settled(bus);

    expect(billing.ids()).toEqual(['evt-1']);
    expect(shipping.ids()).toEqual(['evt-1']);
    expect(bus.describeTopology().queues.filter((queue) => queue.role === 'work')).toHaveLength(2);
  });
});
