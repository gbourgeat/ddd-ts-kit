import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RabbitMqEventBus, queueNamesOf } from '../src';
import type { Broker } from './support/broker';
import { BROKERS } from './support/brokers';
import { PLACED, TRACEPARENT, anEvent } from './support/events';
import { recorder } from './support/recorder';
import { unique } from './support/unique';
import { eventually } from './support/waiting';

describe.each(BROKERS)('RabbitMqEventBus: consuming, %s', { timeout: 30_000 }, (_name, connect) => {
  let broker: Broker;

  beforeEach(async () => {
    broker = await connect();
  });

  afterEach(async () => {
    await broker.dispose();
  });

  it('needs a consumer name', () => {
    const anonymous = new RabbitMqEventBus({ connection: broker.connection });

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

  it('needs a consumer name for forConsumer too', () => {
    expect(() => broker.bus().forConsumer('')).toThrow(expect.objectContaining({ code: 'CONSUMER_NAME_REQUIRED' }));
  });

  it('starts consuming a subscription made once it is connected, before it publishes again', async () => {
    const bus = broker.bus();
    const billing = recorder();

    await bus.publish([anEvent('evt-0')]);
    bus.subscribe(PLACED, billing.handler);
    await bus.publish([anEvent('evt-1')]);
    await broker.settled(bus);

    expect(billing.ids()).toEqual(['evt-1']);
  });

  it('stops reading when the last handler unsubscribes, while its queue keeps receiving', async () => {
    const consumer = unique('billing');
    const bus = broker.bus({ consumer });
    const [first, second] = [recorder(), recorder()];
    const subscriptions = [bus.subscribe(PLACED, first.handler), bus.subscribe(PLACED, second.handler)];

    await bus.publish([anEvent('evt-1')]);
    await broker.settled(bus);
    subscriptions[0]?.unsubscribe();
    await bus.publish([anEvent('evt-2')]);
    await broker.settled(bus);
    broker.remember(bus);
    subscriptions[1]?.unsubscribe();
    await bus.publish([anEvent('evt-3')]);

    await eventually(async () => (await broker.readyIn(queueNamesOf({ consumer, type: PLACED }).work)) === 1);
    expect(first.ids()).toEqual(['evt-1']);
    expect(second.ids()).toEqual(['evt-1', 'evt-2']);
  });
});
