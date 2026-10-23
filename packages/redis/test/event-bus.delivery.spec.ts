import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PLACED, TRACEPARENT, anEvent, recorder, unique } from './support/events';
import { REAL_SERVER, SERVER_URL } from './support/server';
import { Server } from './support/streams';

describe.skipIf(!REAL_SERVER)('RedisStreamsEventBus, delivering', { timeout: 30_000 }, () => {
  let server: Server;

  beforeEach(() => {
    server = Server.connect(SERVER_URL);
  });

  afterEach(async () => {
    await server.dispose();
  });

  it('carries the envelope to the handler with its trace context untouched', async () => {
    const bus = server.bus();
    const billing = recorder();

    bus.subscribe(PLACED, billing.handler);
    const event = { ...anEvent('evt-1'), traceparent: TRACEPARENT, correlationId: 'corr-1' };

    await bus.publish([event]);
    await server.settled(bus);

    expect(billing.received).toEqual([event]);
  });

  it('gives every event to each consumer, and shares them between two instances of one', async () => {
    const prefix = unique('test-events');
    const billingName = unique('billing');
    const publisher = server.bus({ prefix });
    const billingA = server.bus({ prefix, consumer: billingName, batchSize: 1 });
    const billingB = server.bus({ prefix, consumer: billingName, batchSize: 1 });
    const shippingBus = server.bus({ prefix, consumer: unique('shipping') });
    const [first, second, shipping] = [recorder(), recorder(), recorder()];

    billingA.subscribe(PLACED, first.handler);
    billingB.subscribe(PLACED, second.handler);
    shippingBus.subscribe(PLACED, shipping.handler);
    await Promise.all([billingA.assertTopology(), billingB.assertTopology(), shippingBus.assertTopology()]);
    const events = Array.from({ length: 20 }, (_, index) => anEvent(`evt-${String(index).padStart(2, '0')}`));

    await publisher.publish(events);
    await Promise.all([billingA, billingB, shippingBus].map((bus) => server.settled(bus)));

    const everyId = events.map((event) => event.id);

    expect(shipping.ids()).toEqual(everyId);
    expect([...first.ids(), ...second.ids()].sort()).toEqual(everyId);
    expect(first.received.length).toBeGreaterThan(0);
    expect(second.received.length).toBeGreaterThan(0);
  });

  it('serves several consuming contexts from one bus with forConsumer', async () => {
    const bus = server.bus();
    const [billing, shipping] = [recorder(), recorder()];

    bus.forConsumer(unique('billing')).subscribe(PLACED, billing.handler);
    bus.forConsumer(unique('shipping')).subscribe(PLACED, shipping.handler);

    await bus.publish([anEvent('evt-1')]);
    await server.settled(bus);

    expect(billing.ids()).toEqual(['evt-1']);
    expect(shipping.ids()).toEqual(['evt-1']);
    expect(bus.describeTopology().groups).toHaveLength(2);
  });

  it('hands the events of a type to a single instance in the order of the stream', async () => {
    const bus = server.bus({ batchSize: 7 });
    const billing = recorder();

    bus.subscribe(PLACED, billing.handler);
    const events = Array.from({ length: 50 }, (_, index) => anEvent(`evt-${String(index).padStart(2, '0')}`));

    await bus.publish(events.slice(0, 25));
    await bus.publish(events.slice(25));
    await server.settled(bus);

    expect(billing.ids()).toEqual(events.map((event) => event.id));
  });
});
