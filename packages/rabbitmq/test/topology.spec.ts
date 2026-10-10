import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Broker } from './support/broker.js';
import { AMQP_URL } from './support/environment.js';
import { PLACED } from './support/events.js';

describe.skipIf(AMQP_URL === undefined)('RabbitMqEventBus: topology', { timeout: 30_000 }, () => {
  let broker: Broker;

  beforeEach(async () => {
    broker = await Broker.connect(AMQP_URL ?? '');
  });

  afterEach(async () => {
    await broker.dispose();
  });

  it('describes what it declares, as data', () => {
    const bus = broker.bus({ exchange: 'shop-events', consumer: 'billing', retry: { delayMs: 5_000 } });

    bus.subscribe(PLACED, async () => undefined);
    const quorum = { 'x-queue-type': 'quorum' };
    const viaDefaultExchange = { 'x-dead-letter-exchange': '' };

    expect(bus.describeTopology()).toEqual({
      exchanges: [{ name: 'shop-events', type: 'topic', durable: true }],
      queues: [
        {
          name: 'billing.ordering.order.placed',
          role: 'work',
          durable: true,
          arguments: {
            ...quorum,
            ...viaDefaultExchange,
            'x-dead-letter-routing-key': 'billing.ordering.order.placed.dead',
          },
        },
        {
          name: 'billing.ordering.order.placed.retry',
          role: 'retry',
          durable: true,
          arguments: {
            ...quorum,
            ...viaDefaultExchange,
            'x-message-ttl': 5_000,
            'x-dead-letter-routing-key': 'billing.ordering.order.placed',
            'x-dead-letter-strategy': 'at-least-once',
            'x-overflow': 'reject-publish',
          },
        },
        { name: 'billing.ordering.order.placed.dead', role: 'dead', durable: true, arguments: quorum },
      ],
      bindings: [
        { exchange: 'shop-events', queue: 'billing.ordering.order.placed', routingKey: PLACED },
      ],
    });
  });

  it('declares it idempotently', async () => {
    const bus = broker.bus();

    bus.subscribe(PLACED, async () => undefined);

    await bus.assertTopology();
    await bus.assertTopology();
    broker.remember(bus);

    for (const queue of bus.describeTopology().queues) {
      expect(await broker.readyIn(queue.name)).toBe(0);
    }
  });
});
