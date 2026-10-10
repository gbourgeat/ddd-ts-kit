import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AsyncLocalStorageExecutionScope,
  executionContext,
  inEventScope,
  scopedPublisher,
  systemActor,
  type ExecutionContext,
  type IntegrationEvent,
} from '@ddd-ts-kit/kernel';
import {
  ATTEMPT_HEADER,
  DEAD_REASON_HEADER,
  ERROR_CODE_HEADER,
  KafkaEventBus,
  POISON_MESSAGE,
  REPLAY_FOR_HEADER,
  SOURCE_HEADER,
  deadTopicOf,
  type KafkaDelivery,
  type KafkaFailure,
} from '../src/index.js';
import {
  Broker,
  KAFKA_BROKERS,
  KAFKA_RELAY,
  MAX_ATTEMPTS,
  RETRY_DELAY_MS,
  anEvent,
  deliveriesOf,
  eventually,
  failuresOf,
  pause,
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

const orderOf = (event: IntegrationEvent): string => String((event.payload as { orderId: string }).orderId);

describe.skipIf(KAFKA_BROKERS === undefined)('KafkaEventBus', { timeout: 60_000 }, () => {
  const brokers = KAFKA_BROKERS ?? '';
  let broker: Broker;
  let relay: FaultyNetwork | undefined;

  beforeEach(async () => {
    broker = await Broker.connect(brokers);
  });

  // The buses leave their groups before the relay goes: a client cut off from the cluster
  // takes its session timeout to close.
  afterEach(async () => {
    relay?.restore();
    await broker.dispose();
    await relay?.close();
    relay = undefined;
  }, 30_000);

  describe('publishing', () => {
    it('writes a record routed by type, keyed, identified and traceable from its headers', async () => {
      const event = { ...anEvent('evt-1'), version: 3, traceparent: TRACEPARENT, correlationId: 'corr-1' };

      await broker.bus().publish([event]);
      await broker.bus({ keyOf: orderOf }).publish([anEvent('evt-2')]);
      const [first, second] = await broker.recordsOf(broker.topicOf(PLACED));

      expect(first?.key).toBe('evt-1');
      expect(first?.headers).toEqual({
        'x-event-id': 'evt-1',
        'x-event-type': PLACED,
        'x-event-version': '3',
        traceparent: TRACEPARENT,
        'x-correlation-id': 'corr-1',
      });
      expect(JSON.parse(first?.value ?? '')).toEqual(event);
      expect(second?.key).toBe('order-evt-2');
      expect(second?.headers).toEqual({ 'x-event-id': 'evt-2', 'x-event-type': PLACED, 'x-event-version': '1' });
    });

    it('creates the topic of a published type with the configured partitions, once', async () => {
      const bus = broker.bus({ topics: { partitions: 3 } });

      await bus.publish([anEvent('evt-1')]);
      await broker.bus({ topics: { partitions: 5 } }).publish([anEvent('evt-2')]);

      expect(await broker.partitionsOf(broker.topicOf(PLACED))).toBe(3);
      expect(await broker.countIn(broker.topicOf(PLACED))).toBe(2);
    });

    it('rejects an event whose topic does not exist when it is told not to create topics', async () => {
      const bus = broker.bus({ topics: { create: false }, publishTimeoutMs: 1_000 });

      const failure: unknown = await bus.publish([anEvent('evt-1')]).catch((error: unknown) => error);

      expect(failure).toMatchObject({ code: 'PUBLISH_NOT_ACKNOWLEDGED', eventIds: ['evt-1'] });
      expect(await broker.countIn(broker.topicOf(PLACED))).toBe(0);
    });

    it('fails with a code, never with the address, when the cluster cannot be reached', async () => {
      const reported: KafkaFailure[] = [];
      const bus = broker.bus({
        brokers: '127.0.0.1:1',
        connectTimeoutMs: 500,
        onFailure: failuresOf(reported),
      });

      const failure: unknown = await bus.publish([anEvent('evt-1')]).catch((error: unknown) => error);

      expect(failure).toMatchObject({ code: 'BROKER_UNAVAILABLE' });
      expect(String(failure)).not.toContain('127.0.0.1');
      expect(reported.every((report) => report.kind === 'connection')).toBe(true);
    });
  });

  describe('consuming', () => {
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

    it('carries the correlation of the publishing work to the execution scope of the consumer', async () => {
      const scope = new AsyncLocalStorageExecutionScope();
      const bus = broker.bus();
      const seen: (ExecutionContext | undefined)[] = [];
      bus.subscribe(
        PLACED,
        inEventScope(scope, { consumer: 'billing.invoice-on-order-placed' }, async () => void seen.push(scope.current())),
      );
      const request = executionContext({ correlationId: 'corr-7', actor: systemActor('checkout'), origin: 'http' });

      await scope.run(request, () => scopedPublisher(bus, scope).publish([anEvent('evt-1')]));
      await scopedPublisher(bus, scope).publish([anEvent('evt-2')]);
      await broker.settled(bus);

      const [first] = await broker.recordsOf(broker.topicOf(PLACED));
      expect(first?.headers).toMatchObject({ 'x-event-id': 'evt-1', 'x-correlation-id': 'corr-7' });
      expect(seen).toEqual([
        {
          correlationId: 'corr-7',
          causationId: 'evt-1',
          actor: systemActor('billing.invoice-on-order-placed'),
          origin: 'event',
          extensions: {},
        },
        {
          correlationId: 'evt-2',
          causationId: 'evt-2',
          actor: systemActor('billing.invoice-on-order-placed'),
          origin: 'event',
          extensions: {},
        },
      ]);
      expect(scope.current()).toBeUndefined();
    });

    it('keeps the correlation across a retry: the redelivery runs in the same context', async () => {
      const scope = new AsyncLocalStorageExecutionScope();
      const bus = broker.bus();
      const correlations: (string | undefined)[] = [];
      let failures = 1;
      bus.subscribe(
        PLACED,
        inEventScope(scope, { consumer: 'billing' }, async () => {
          correlations.push(scope.current()?.correlationId);
          if (failures > 0) {
            failures -= 1;
            throw new InvoicingFailed();
          }
        }),
      );

      await bus.publish([{ ...anEvent('evt-1'), correlationId: 'corr-1' }]);
      await broker.settled(bus);

      expect(correlations).toEqual(['corr-1', 'corr-1']);
    });

    it('delivers an event again, after the delay, when its handler failed', async () => {
      const consumer = broker.consumer('billing');
      const reported: KafkaFailure[] = [];
      const settled: KafkaDelivery[] = [];
      const bus = broker.bus({ consumer, onFailure: failuresOf(reported), onDelivery: deliveriesOf(settled) });
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
          consumer,
          topic: broker.topicOf(PLACED),
          eventId: 'evt-1',
          eventType: PLACED,
          code: 'INVOICING_FAILED',
          attempt: 1,
          dead: false,
        },
      ]);
    });

    it('copies an event to the dead-letter topic once its attempts are spent, with a code and no message, and moves on', async () => {
      const consumer = broker.consumer('billing');
      const reported: KafkaFailure[] = [];
      const bus = broker.bus({ consumer, keyOf: () => 'order-1', onFailure: failuresOf(reported) });
      const handled: string[] = [];
      bus.subscribe(PLACED, async (event) => {
        handled.push(event.id);
        if (event.id === 'evt-1') {
          throw new InvoicingFailed();
        }
      });
      const topic = broker.topicOf(PLACED);

      await bus.publish([anEvent('evt-1'), anEvent('evt-2')]);
      await broker.settled(bus);
      const dead = await broker.recordsOf(deadTopicOf(consumer, topic));

      expect(handled).toEqual(['evt-1', 'evt-1', 'evt-1', 'evt-2']);
      expect(reported.map((failure) => failure.kind === 'handler' && failure.dead)).toEqual([false, false, true]);
      expect(dead).toHaveLength(1);
      expect(dead[0]?.key).toBe('order-1');
      expect(dead[0]?.headers).toMatchObject({
        'x-event-id': 'evt-1',
        [ATTEMPT_HEADER]: String(MAX_ATTEMPTS),
        [ERROR_CODE_HEADER]: 'INVOICING_FAILED',
        [DEAD_REASON_HEADER]: 'max-attempts',
        [SOURCE_HEADER]: `${topic}/0/0`,
      });
      expect(JSON.parse(dead[0]?.value ?? '')).toEqual(anEvent('evt-1'));
      expect(JSON.stringify([reported, dead])).not.toContain('jane.doe');
      expect(await broker.lagOf(consumer, [topic])).toBe(0);
    });

    it('replays dead letters to their consumer only, with a fresh attempt budget', async () => {
      const consumer = broker.consumer('billing');
      const billingBus = broker.bus({ consumer });
      const shippingBus = broker.bus();
      const [billing, shipping] = [recorder(MAX_ATTEMPTS), recorder()];
      billingBus.subscribe(PLACED, billing.handler);
      shippingBus.subscribe(PLACED, shipping.handler);
      const topic = broker.topicOf(PLACED);

      await billingBus.publish([anEvent('evt-1')]);
      await Promise.all([broker.settled(billingBus), broker.settled(shippingBus)]);
      expect(await billingBus.replayDead({ consumer, type: PLACED })).toBe(1);
      await Promise.all([broker.settled(billingBus), broker.settled(shippingBus)]);

      expect(billing.received).toHaveLength(MAX_ATTEMPTS + 1);
      expect(shipping.ids()).toEqual(['evt-1']);
      expect((await broker.recordsOf(topic))[1]?.headers).toMatchObject({ [REPLAY_FOR_HEADER]: consumer });
      expect(await billingBus.replayDead({ consumer, type: PLACED })).toBe(0);
    });

    it('copies a record that is not an envelope straight to the dead-letter topic and moves on', async () => {
      const consumer = broker.consumer('billing');
      const reported: KafkaFailure[] = [];
      const bus = broker.bus({ consumer, onFailure: failuresOf(reported) });
      const billing = recorder();
      bus.subscribe(PLACED, billing.handler);
      const topic = broker.topicOf(PLACED);
      await bus.assertTopology();

      await broker.send(topic, '{"id": not json');
      await broker.send(topic, JSON.stringify({ id: 'evt-0' }));
      await bus.publish([anEvent('evt-1')]);
      await broker.settled(bus);
      const dead = await broker.recordsOf(deadTopicOf(consumer, topic));

      expect(billing.ids()).toEqual(['evt-1']);
      expect(reported).toEqual([
        { kind: 'poison', consumer, topic, code: POISON_MESSAGE },
        { kind: 'poison', consumer, topic, code: POISON_MESSAGE },
      ]);
      expect(dead.map((record) => record.value)).toEqual(['{"id": not json', '{"id":"evt-0"}']);
      expect(dead[0]?.headers).toMatchObject({
        [ERROR_CODE_HEADER]: POISON_MESSAGE,
        [DEAD_REASON_HEADER]: 'poison',
      });
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

  describe('topology', () => {
    it('describes what it creates and joins, as data', () => {
      const bus = new KafkaEventBus({
        brokers,
        consumer: 'billing',
        publishedTypes: ['billing.invoice.issued'],
        topics: { partitions: 6, replicationFactor: 3 },
      });
      bus.subscribe(PLACED, async () => undefined);
      const sized = { partitions: 6, replicationFactor: 3 };

      expect(bus.describeTopology()).toEqual({
        topics: [
          { name: 'billing.invoice.issued', role: 'events', ...sized },
          { name: 'ordering.order.placed', role: 'events', ...sized },
          { name: 'billing.ordering.order.placed.dead', role: 'dead', ...sized },
        ],
        groups: [{ groupId: 'billing', topics: ['ordering.order.placed'] }],
      });
    });

    it('creates it idempotently', async () => {
      const consumer = broker.consumer('billing');
      const bus = broker.bus({ consumer, publishedTypes: ['billing.invoice.issued'], topics: { partitions: 2 } });
      bus.subscribe(PLACED, async () => undefined);

      await bus.assertTopology();
      await bus.assertTopology();
      await broker.bus({ consumer, topics: { partitions: 2 } }).assertTopology();

      for (const topic of bus.describeTopology().topics) {
        expect(await broker.partitionsOf(topic.name)).toBe(2);
      }
      expect(bus.describeTopology().topics.map((topic) => topic.name)).toEqual([
        broker.topicOf('billing.invoice.issued'),
        broker.topicOf(PLACED),
        deadTopicOf(consumer, broker.topicOf(PLACED)),
      ]);
    });
  });

  describe.skipIf(KAFKA_RELAY === undefined)('when the connection is lost', () => {
    const relayed = async (): Promise<FaultyNetwork> => {
      relay = await FaultyNetwork.from(KAFKA_RELAY ?? '');
      return relay;
    };

    it('resolves only once the broker acknowledged, and rejects a publication cut mid-flight', async () => {
      const network = await relayed();
      const bus = broker.bus({ brokers: network.brokers, publishTimeoutMs: 1_500 });
      await bus.publish([anEvent('evt-0')]);

      network.holdReplies();
      const sent = network.bytesFromClient;
      const publication = bus.publish([anEvent('evt-1'), anEvent('evt-2')]);
      const outcome = publication.then(
        () => 'acknowledged',
        (error: unknown) => error,
      );
      await eventually(() => network.bytesFromClient > sent);
      expect(await Promise.race([outcome, pause(300).then(() => 'still waiting')])).toBe('still waiting');
      network.refuseConnections();
      network.cutConnections();

      expect(await outcome).toMatchObject({
        code: 'PUBLISH_NOT_ACKNOWLEDGED',
        reason: 'ERR__MSG_TIMED_OUT',
        eventIds: ['evt-1', 'evt-2'],
      });
    });

    it('rejects while the cluster is away, then publishes and consumes again by itself', async () => {
      const network = await relayed();
      const bus = broker.bus({ brokers: network.brokers, publishTimeoutMs: 1_000 });
      const billing = recorder();
      bus.subscribe(PLACED, billing.handler);
      await bus.publish([anEvent('evt-1')]);
      await broker.settled(bus);

      network.refuseConnections();
      network.cutConnections();
      await expect(bus.publish([anEvent('evt-lost')])).rejects.toMatchObject({ code: 'PUBLISH_NOT_ACKNOWLEDGED' });
      network.restore();
      await eventually(() => bus.publish([anEvent('evt-2')]).then(() => true, () => false));
      await broker.settled(bus);

      expect([...new Set(billing.ids())]).toEqual(['evt-1', 'evt-2']);
    });

    it('receives, once back, what was published while it was away', async () => {
      const network = await relayed();
      const publisher = broker.bus();
      const consumerBus = broker.bus({ brokers: network.brokers });
      const billing = recorder();
      consumerBus.subscribe(PLACED, billing.handler);
      await consumerBus.assertTopology();

      network.refuseConnections();
      network.cutConnections();
      await publisher.publish([anEvent('evt-1')]);
      network.restore();
      await eventually(() => billing.received.length >= 1, 30_000);

      expect([...new Set(billing.ids())]).toEqual(['evt-1']);
    });
  });

  describe('closing', () => {
    it('lets the handler in progress finish and commit before it leaves the group', async () => {
      const consumer = broker.consumer('billing');
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

      const closing = bus.close().then(() => 'closed');
      expect(await Promise.race([closing, pause(100).then(() => 'draining')])).toBe('draining');
      finish();

      expect(await closing).toBe('closed');
      expect(done).toEqual(['evt-1']);
      expect(await broker.lagOf(consumer, [broker.topicOf(PLACED)])).toBe(0);
    });

    it('leaves a record that waits for its retry uncommitted, for the next start', async () => {
      const consumer = broker.consumer('billing');
      const bus = broker.bus({ consumer, retry: { delayMs: 60_000, maxAttempts: 3 } });
      const billing = recorder(1);
      bus.subscribe(PLACED, billing.handler);
      await bus.publish([anEvent('evt-1')]);
      await eventually(() => billing.received.length === 1);
      await bus.close();
      expect(await broker.lagOf(consumer, [broker.topicOf(PLACED)])).toBe(1);

      const restarted = broker.bus({ consumer });
      restarted.subscribe(PLACED, billing.handler);
      await broker.settled(restarted);

      expect(billing.ids()).toEqual(['evt-1', 'evt-1']);
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
