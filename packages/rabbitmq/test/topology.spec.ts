import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Broker } from './support/broker';
import { BROKERS } from './support/brokers';
import { PLACED, anEvent } from './support/events';
import { failuresOf } from './support/hooks';
import { unique } from './support/unique';
import { eventually } from './support/waiting';
import { queueNamesOf, type RabbitMqFailure } from '../src';

describe.each(BROKERS)('RabbitMqEventBus: topology, %s', { timeout: 30_000 }, (_name, connect) => {
  let broker: Broker;

  beforeEach(async () => {
    broker = await connect();
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
      bindings: [{ exchange: 'shop-events', queue: 'billing.ordering.order.placed', routingKey: PLACED }],
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

  it('rejects, with the code of the broker, a declaration that contradicts what exists', async () => {
    const exchange = unique('test-events');
    const bus = broker.bus({ exchange });

    bus.subscribe(PLACED, async () => undefined);
    await bus.assertTopology();
    await broker.deleteExchange(exchange);
    await broker.declareExchange(exchange, 'fanout');

    await expect(bus.assertTopology()).rejects.toMatchObject({ code: 406 });
  });

  it('cannot connect while its exchange exists with another type, and says why', async () => {
    const exchange = unique('test-events');
    const reported: RabbitMqFailure[] = [];

    await broker.declareExchange(exchange, 'fanout');
    const bus = broker.bus({ exchange, onFailure: failuresOf(reported) });

    await expect(bus.publish([anEvent('evt-1')])).rejects.toMatchObject({
      code: 'BROKER_UNAVAILABLE',
      reason: 'AMQP_406',
    });

    expect(reported[0]).toEqual({ kind: 'connection', code: 'AMQP_406' });
  });

  it('reports a queue it cannot declare for a subscription made once connected', async () => {
    const consumer = unique('billing');
    const reported: RabbitMqFailure[] = [];
    const bus = broker.bus({ consumer, onFailure: failuresOf(reported) });

    await bus.publish([anEvent('evt-0')]);
    await broker.declareQueue(queueNamesOf({ consumer, type: PLACED }).work, { 'x-queue-type': 'classic' });
    bus.subscribe(PLACED, async () => undefined);

    await eventually(() => reported.some((failure) => failure.kind === 'connection' && failure.code === 'AMQP_406'));
    broker.remember(bus);
  });
});
