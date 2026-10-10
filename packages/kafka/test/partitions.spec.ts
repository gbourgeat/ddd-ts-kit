import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type IntegrationEvent } from '@ddd-ts-kit/kernel';
import { Broker } from './support/broker.js';
import { KAFKA_BROKERS } from './support/environment.js';
import { PLACED, anEvent } from './support/events.js';
import { InvoicingFailed } from './support/invoicing-failed.js';
import { orderOf } from './support/order-of.js';
import { recorder } from './support/recorder.js';
import { eventually, pause } from './support/waiting.js';

describe.skipIf(KAFKA_BROKERS === undefined)('KafkaEventBus: partitions', { timeout: 60_000 }, () => {
  let broker: Broker;

  beforeEach(async () => {
    broker = await Broker.connect(KAFKA_BROKERS ?? '');
  });

  afterEach(async () => {
    await broker.dispose();
  }, 30_000);

  it('keeps the events of one key in order, a retry included', async () => {
    const bus = broker.bus({ topics: { partitions: 4 }, keyOf: orderOf });
    const handled: IntegrationEvent[] = [];
    let failures = 1;

    bus.subscribe(PLACED, async (event) => {
      if (event.id === 'b-1' && failures > 0) {
        failures -= 1;
        throw new InvoicingFailed();
      }

      handled.push(event);
    });

    const events = [0, 1, 2, 3, 4].flatMap((step) =>
      ['a', 'b', 'c'].map((order) => ({ ...anEvent(`${order}-${String(step)}`), payload: { orderId: order } })),
    );

    await bus.publish(events);
    await broker.settled(bus);

    for (const order of ['a', 'b', 'c']) {
      const steps = handled.filter((event) => orderOf(event) === order).map((event) => event.id);

      expect(steps).toEqual([0, 1, 2, 3, 4].map((step) => `${order}-${String(step)}`));
    }
  });

  it('loses nothing when a second instance joins and the partitions are shared out again', async () => {
    const consumer = broker.consumer('billing');
    const topics = { partitions: 4 };
    const [first, second] = [recorder(), recorder()];
    const billingA = broker.bus({ topics, consumer });

    billingA.subscribe(PLACED, async (event) => {
      await pause(15);
      await first.handler(event);
    });

    await billingA.assertTopology();
    const events = Array.from({ length: 40 }, (_, index) => anEvent(`evt-${String(index).padStart(2, '0')}`));

    await billingA.publish(events);
    await eventually(() => first.received.length >= 3);

    const billingB = broker.bus({ topics, consumer });

    billingB.subscribe(PLACED, second.handler);
    await Promise.all([broker.settled(billingA), broker.settled(billingB)]);

    const handled = new Set([...first.ids(), ...second.ids()]);

    expect([...handled].sort()).toEqual(events.map((event) => event.id));
    expect(await broker.lagOf(consumer, [broker.topicOf(PLACED)])).toBe(0);
    expect(billingA.partitionsAssigned + billingB.partitionsAssigned).toBe(4);
  });
});
