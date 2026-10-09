import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import {
  ATTEMPT_HEADER,
  DEAD_REASON_HEADER,
  ERROR_CODE_HEADER,
  POISON_MESSAGE,
  RabbitMqEventBus,
  queueNamesOf,
  type RabbitMqDelivery,
  type RabbitMqFailure,
} from '../src/index.js';
import {
  AMQP_URL,
  Broker,
  MAX_ATTEMPTS,
  RETRY_DELAY_MS,
  anEvent,
  deliveriesOf,
  eventually,
  failuresOf,
  pause,
  unique,
} from './support/broker.js';
import { FaultyNetwork } from './support/proxy.js';

const PLACED = 'ordering.order.placed';
const TRACEPARENT = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';

class InvoicingFailed extends Error {
  readonly code = 'INVOICING_FAILED';

  constructor() {
    super('could not invoice jane.doe@example.com');
  }
}

/** A handler that records what it receives and fails its first `failures` deliveries. */
const recorder = (failures = 0) => {
  const received: IntegrationEvent[] = [];
  let remaining = failures;
  const handler = async (event: IntegrationEvent): Promise<void> => {
    received.push(event);
    if (remaining > 0) {
      remaining -= 1;
      throw new InvoicingFailed();
    }
  };
  return { received, handler, ids: () => received.map((event) => event.id) };
};

describe.skipIf(AMQP_URL === undefined)('RabbitMqEventBus', { timeout: 30_000 }, () => {
  const url = AMQP_URL ?? '';
  let broker: Broker;

  beforeEach(async () => {
    broker = await Broker.connect(url);
  });

  afterEach(async () => {
    await broker.dispose();
  });

  describe('publishing', () => {
    it('sends a persistent message routed by type, identified and traceable from its properties', async () => {
      const exchange = unique('test-events');
      const tap = await broker.tap(exchange);
      const event = { ...anEvent('evt-1'), version: 3, traceparent: TRACEPARENT, correlationId: 'corr-1' };

      await broker.bus({ exchange }).publish([event]);
      const message = await broker.take(tap);

      expect(message?.fields).toMatchObject({ exchange, routingKey: PLACED });
      expect(message?.properties).toMatchObject({
        deliveryMode: 2,
        messageId: 'evt-1',
        type: PLACED,
        contentType: 'application/json',
        correlationId: 'corr-1',
        headers: { traceparent: TRACEPARENT, 'x-correlation-id': 'corr-1', 'x-event-version': 3 },
      });
      expect(JSON.parse(message?.content.toString() ?? '')).toEqual(event);
    });

    it('resolves only once the broker confirmed, and rejects a publication cut mid-flight', async () => {
      const network = await FaultyNetwork.to(url);
      const bus = broker.bus({ connection: network.url });
      await bus.assertTopology();

      network.holdReplies();
      const sent = network.bytesFromClient;
      const publication = bus.publish([anEvent('evt-1'), anEvent('evt-2')]);
      const outcome = publication.then(
        () => 'confirmed',
        (error: unknown) => error,
      );
      await eventually(() => network.bytesFromClient > sent);
      expect(await Promise.race([outcome, pause(100).then(() => 'still waiting')])).toBe('still waiting');
      network.cutConnections();

      expect(await outcome).toMatchObject({ code: 'PUBLISH_NOT_CONFIRMED' });
      await network.close();
    });

    it('accepts an event no queue is bound for, unless told to fail', async () => {
      const exchange = unique('test-events');
      const lenient = broker.bus({ exchange });
      const strict = broker.bus({ exchange, onUnroutable: 'fail' });

      expect(await lenient.publish([anEvent('evt-1')])).toBeUndefined();
      await expect(strict.publish([anEvent('evt-2')])).rejects.toMatchObject({
        code: 'UNROUTABLE_EVENT',
        eventId: 'evt-2',
        eventType: PLACED,
      });
    });

    it('confirms a routable event under the strict policy', async () => {
      const bus = broker.bus({ onUnroutable: 'fail' });
      const billing = recorder();
      bus.subscribe(PLACED, billing.handler);

      await bus.publish([anEvent('evt-1')]);
      await broker.settled(bus);

      expect(billing.ids()).toEqual(['evt-1']);
    });

    it('fails with a code, never with the URL, when the broker cannot be reached', async () => {
      const network = await FaultyNetwork.to(url);
      const unreachable = network.url;
      await network.close();
      const reported: RabbitMqFailure[] = [];
      const bus = broker.bus({ connection: unreachable, onFailure: failuresOf(reported) });

      const failure: unknown = await bus.publish([anEvent('evt-1')]).catch((error: unknown) => error);

      expect(failure).toMatchObject({ code: 'BROKER_UNAVAILABLE', reason: 'ECONNREFUSED' });
      expect(String(failure)).not.toContain('kit');
      expect(reported).toEqual([{ kind: 'connection', code: 'ECONNREFUSED' }]);
    });
  });

  describe('consuming', () => {
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

    it('delivers an event again, after the delay, when its handler failed', async () => {
      const reported: RabbitMqFailure[] = [];
      const settled: RabbitMqDelivery[] = [];
      const bus = broker.bus({ onFailure: failuresOf(reported), onDelivery: deliveriesOf(settled) });
      const billing = recorder(1);
      const started = Date.now();
      bus.subscribe(PLACED, billing.handler);

      await bus.publish([anEvent('evt-1')]);
      await broker.settled(bus);

      expect(billing.ids()).toEqual(['evt-1', 'evt-1']);
      expect(Date.now() - started).toBeGreaterThanOrEqual(RETRY_DELAY_MS);
      expect(settled.map(({ attempt, outcome }) => `${String(attempt)}:${outcome}`)).toEqual([
        '1:retried',
        '2:acknowledged',
      ]);
      expect(reported).toEqual([
        {
          kind: 'handler',
          queue: `${bus.describeTopology().queues[0]?.name ?? ''}`,
          eventId: 'evt-1',
          eventType: PLACED,
          code: 'INVOICING_FAILED',
          attempt: 1,
          dead: false,
        },
      ]);
    });

    it('moves an event to the dead queue once its attempts are spent, with a code and no message', async () => {
      const consumer = unique('billing');
      const reported: RabbitMqFailure[] = [];
      const bus = broker.bus({ consumer, onFailure: failuresOf(reported) });
      const billing = recorder(Number.POSITIVE_INFINITY);
      bus.subscribe(PLACED, billing.handler);
      const queues = queueNamesOf({ consumer, type: PLACED });

      await bus.publish([anEvent('evt-1')]);
      await broker.settled(bus);
      const dead = await broker.take(queues.dead);

      expect(billing.received).toHaveLength(MAX_ATTEMPTS);
      expect(reported.map((failure) => failure.kind === 'handler' && failure.dead)).toEqual([false, false, true]);
      expect(dead?.properties.headers).toMatchObject({
        [ATTEMPT_HEADER]: MAX_ATTEMPTS,
        [ERROR_CODE_HEADER]: 'INVOICING_FAILED',
        [DEAD_REASON_HEADER]: 'max-attempts',
      });
      expect(JSON.parse(dead?.content.toString() ?? '')).toEqual(anEvent('evt-1'));
      expect(JSON.stringify([reported, dead?.properties])).not.toContain('jane.doe');
      expect(await broker.readyIn(queues.work)).toBe(0);
      expect(await broker.readyIn(queues.retry)).toBe(0);
    });

    it('replays dead messages with a fresh attempt budget', async () => {
      const consumer = unique('billing');
      const bus = broker.bus({ consumer });
      const billing = recorder(MAX_ATTEMPTS);
      bus.subscribe(PLACED, billing.handler);

      await bus.publish([anEvent('evt-1')]);
      await broker.settled(bus);
      expect(await bus.replayDead({ consumer, type: PLACED })).toBe(1);
      await broker.settled(bus);

      expect(billing.received).toHaveLength(MAX_ATTEMPTS + 1);
      expect(await broker.readyIn(queueNamesOf({ consumer, type: PLACED }).dead)).toBe(0);
    });

    it('sends a message that is not an envelope straight to the dead queue', async () => {
      const consumer = unique('billing');
      const exchange = unique('test-events');
      const reported: RabbitMqFailure[] = [];
      const bus = broker.bus({ consumer, exchange, onFailure: failuresOf(reported) });
      const billing = recorder();
      bus.subscribe(PLACED, billing.handler);
      const queues = queueNamesOf({ consumer, type: PLACED });
      await bus.assertTopology();

      broker.send(exchange, PLACED, Buffer.from('{"id": not json'));
      broker.send(exchange, PLACED, Buffer.from(JSON.stringify({ id: 'evt-1' })));
      await eventually(async () => (await broker.readyIn(queues.dead)) === 2);
      const dead = await broker.take(queues.dead);

      expect(billing.received).toEqual([]);
      expect(reported).toEqual([
        { kind: 'poison', queue: queues.work, code: POISON_MESSAGE },
        { kind: 'poison', queue: queues.work, code: POISON_MESSAGE },
      ]);
      expect(dead?.properties.headers).toMatchObject({
        [ERROR_CODE_HEADER]: POISON_MESSAGE,
        [DEAD_REASON_HEADER]: 'poison',
      });
      expect(await broker.readyIn(queues.retry)).toBe(0);
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

  describe('topology', () => {
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

  describe('when the connection is lost', () => {
    it('reconnects, declares its topology again and resumes consuming', async () => {
      const network = await FaultyNetwork.to(url);
      const reported: RabbitMqFailure[] = [];
      const bus = broker.bus({ connection: network.url, onFailure: failuresOf(reported) });
      const billing = recorder();
      bus.subscribe(PLACED, billing.handler);
      await bus.publish([anEvent('evt-1')]);
      await broker.settled(bus);

      network.refuseConnections();
      network.cutConnections();
      await eventually(() => reported.length >= 2);
      await expect(bus.publish([anEvent('evt-lost')])).rejects.toMatchObject({ code: 'BROKER_UNAVAILABLE' });
      network.restore();
      await eventually(() => bus.publish([anEvent('evt-2')]).then(() => true, () => false));
      await broker.settled(bus);

      expect(billing.ids()).toEqual(['evt-1', 'evt-2']);
      expect(reported[0]).toEqual({ kind: 'connection', code: 'CONNECTION_LOST' });
      await network.close();
    });

    it('receives, once back, what was published while it was away', async () => {
      const network = await FaultyNetwork.to(url);
      const exchange = unique('test-events');
      const publisher = broker.bus({ exchange });
      const consumerBus = broker.bus({ exchange, connection: network.url });
      const billing = recorder();
      consumerBus.subscribe(PLACED, billing.handler);
      await consumerBus.assertTopology();

      network.refuseConnections();
      network.cutConnections();
      await publisher.publish([anEvent('evt-1')]);
      network.restore();
      await eventually(() => billing.received.length === 1);

      expect(billing.ids()).toEqual(['evt-1']);
      await network.close();
    });
  });

  describe('closing', () => {
    it('lets the handler in progress finish and acknowledge before it disconnects', async () => {
      const consumer = unique('billing');
      const bus = broker.bus({ consumer });
      let finish: () => void = () => undefined;
      const working = new Promise<void>((resolve) => {
        finish = resolve;
      });
      const done: string[] = [];
      bus.subscribe(PLACED, async (event) => {
        await working;
        done.push(event.id);
      });
      await bus.publish([anEvent('evt-1')]);
      await eventually(() => bus.deliveriesInFlight === 1);
      broker.remember(bus);

      const closing = bus.close().then(() => 'closed');
      expect(await Promise.race([closing, pause(100).then(() => 'draining')])).toBe('draining');
      finish();

      expect(await closing).toBe('closed');
      expect(done).toEqual(['evt-1']);
      expect(await broker.readyIn(queueNamesOf({ consumer, type: PLACED }).work)).toBe(0);
    });

    it('refuses to publish or subscribe once closed', async () => {
      const bus = broker.bus();
      await bus.publish([anEvent('evt-1')]);

      await bus.close();
      await bus.close();

      await expect(bus.publish([anEvent('evt-2')])).rejects.toMatchObject({ code: 'EVENT_BUS_CLOSED' });
      expect(() => bus.subscribe(PLACED, async () => undefined)).toThrow(
        expect.objectContaining({ code: 'EVENT_BUS_CLOSED' }),
      );
    });
  });
});
