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
  NatsEventBus,
  POISON_MESSAGE,
  REPLAY_FOR_HEADER,
  SOURCE_HEADER,
  type NatsDelivery,
  type NatsFailure,
} from '../src/index.js';
import {
  Broker,
  MAX_ATTEMPTS,
  NATS_URL,
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

describe.skipIf(NATS_URL === undefined)('NatsEventBus', { timeout: 30_000 }, () => {
  const url = NATS_URL ?? '';
  let broker: Broker;

  beforeEach(async () => {
    broker = await Broker.connect(url);
  });

  afterEach(async () => {
    await broker.dispose();
  });

  describe('publishing', () => {
    it('stores a message on the subject of its type, identified and traceable from its headers', async () => {
      const event = { ...anEvent('evt-1'), version: 3, traceparent: TRACEPARENT, correlationId: 'corr-1' };

      await broker.bus().publish([event]);
      const [message] = await broker.published();

      expect(message?.subject).toBe(`${broker.subjectPrefix}.${PLACED}`);
      expect(message?.headers).toEqual({
        'Nats-Msg-Id': 'evt-1',
        'x-event-type': PLACED,
        'x-event-version': '3',
        traceparent: TRACEPARENT,
        'x-correlation-id': 'corr-1',
      });
      expect(JSON.parse(message?.body ?? '')).toEqual(event);
    });

    it('lets the stream drop an event published twice inside the duplicate window, not after it', async () => {
      const bus = broker.bus({ duplicateWindowMs: 500 });
      const billing = recorder();
      bus.subscribe(PLACED, billing.handler);

      await bus.publish([anEvent('evt-1')]);
      await bus.publish([anEvent('evt-1')]);
      await broker.settled(bus);
      expect(billing.ids()).toEqual(['evt-1']);

      await pause(1_200);
      await bus.publish([anEvent('evt-1')]);
      await broker.settled(bus);
      expect(billing.ids()).toEqual(['evt-1', 'evt-1']);
    });

    it('resolves only once the stream acknowledged, and rejects a publication cut mid-flight', async () => {
      const network = await FaultyNetwork.to(url);
      const bus = broker.bus({ connection: network.url, publishTimeoutMs: 1_000 });
      await bus.assertTopology();

      network.holdReplies();
      const sent = network.bytesFromClient;
      const publication = bus.publish([anEvent('evt-1'), anEvent('evt-2')]);
      const outcome = publication.then(
        () => 'acknowledged',
        (error: unknown) => error,
      );
      await eventually(() => network.bytesFromClient > sent);
      expect(await Promise.race([outcome, pause(100).then(() => 'still waiting')])).toBe('still waiting');
      network.cutConnections();

      expect(await outcome).toMatchObject({ code: 'PUBLISH_NOT_ACKNOWLEDGED', eventId: 'evt-1' });
      await bus.close();
      await network.close();
    });

    it('fails with a code, never with the URL, when the server cannot be reached', async () => {
      const network = await FaultyNetwork.to(url);
      const unreachable = network.url;
      await network.close();
      const reported: NatsFailure[] = [];
      const bus = broker.bus({ connection: unreachable, onFailure: failuresOf(reported) });

      const failure: unknown = await bus.publish([anEvent('evt-1')]).catch((error: unknown) => error);

      expect(failure).toMatchObject({ code: 'BROKER_UNAVAILABLE', reason: 'ECONNREFUSED' });
      expect(String(failure)).not.toContain('127.0.0.1');
      expect(reported).toEqual([{ kind: 'connection', code: 'ECONNREFUSED' }]);
    });
  });

  describe('consuming', () => {
    it('needs a consumer name', () => {
      const anonymous = new NatsEventBus({ connection: url });

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
      const bus = broker.bus({ prefetch: 1 });
      const seen: (ExecutionContext | undefined)[] = [];
      bus.subscribe(
        PLACED,
        inEventScope(scope, { consumer: 'billing.invoice-on-order-placed' }, async () => void seen.push(scope.current())),
      );
      const request = executionContext({ correlationId: 'corr-7', actor: systemActor('checkout'), origin: 'http' });

      await scope.run(request, () => scopedPublisher(bus, scope).publish([anEvent('evt-1')]));
      await scopedPublisher(bus, scope).publish([anEvent('evt-2')]);
      await broker.settled(bus);

      expect((await broker.published())[0]?.headers).toMatchObject({
        'Nats-Msg-Id': 'evt-1',
        'x-correlation-id': 'corr-7',
      });
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
      const consumer = unique('billing');
      const reported: NatsFailure[] = [];
      const settled: NatsDelivery[] = [];
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
          consumer: broker.namesOf({ consumer, type: PLACED }).durable,
          eventId: 'evt-1',
          eventType: PLACED,
          code: 'INVOICING_FAILED',
          attempt: 1,
          dead: false,
        },
      ]);
    });

    it('moves an event to the dead-letter stream once its attempts are spent, with a code and no message', async () => {
      const consumer = unique('billing');
      const reported: NatsFailure[] = [];
      const bus = broker.bus({ consumer, onFailure: failuresOf(reported) });
      const billing = recorder(Number.POSITIVE_INFINITY);
      bus.subscribe(PLACED, billing.handler);
      const names = broker.namesOf({ consumer, type: PLACED });

      await bus.publish([anEvent('evt-1')]);
      await broker.settled(bus);
      const dead = await broker.dead();

      expect(billing.received).toHaveLength(MAX_ATTEMPTS);
      expect(reported.map((failure) => failure.kind === 'handler' && failure.dead)).toEqual([false, false, true]);
      expect(dead).toHaveLength(1);
      expect(dead[0]?.subject).toBe(names.deadSubject);
      expect(dead[0]?.headers).toMatchObject({
        [ATTEMPT_HEADER]: String(MAX_ATTEMPTS),
        [ERROR_CODE_HEADER]: 'INVOICING_FAILED',
        [DEAD_REASON_HEADER]: 'max-attempts',
        [SOURCE_HEADER]: `${broker.stream}/1`,
        'x-event-type': PLACED,
      });
      expect(JSON.parse(dead[0]?.body ?? '')).toEqual(anEvent('evt-1'));
      expect(JSON.stringify([reported, dead])).not.toContain('jane.doe');
      expect(await broker.waitingFor(names.durable)).toBe(0);
    });

    it('replays dead messages to their consumer only, with a fresh attempt budget', async () => {
      const consumer = unique('billing');
      const billingBus = broker.bus({ consumer });
      const shippingBus = broker.bus();
      const [billing, shipping] = [recorder(MAX_ATTEMPTS), recorder()];
      billingBus.subscribe(PLACED, billing.handler);
      shippingBus.subscribe(PLACED, shipping.handler);
      await shippingBus.assertTopology();

      await billingBus.publish([anEvent('evt-1')]);
      await Promise.all([broker.settled(billingBus), broker.settled(shippingBus)]);
      expect(await billingBus.replayDead({ consumer, type: PLACED })).toBe(1);
      await Promise.all([broker.settled(billingBus), broker.settled(shippingBus)]);

      expect(billing.received).toHaveLength(MAX_ATTEMPTS + 1);
      expect(shipping.ids()).toEqual(['evt-1']);
      expect((await broker.published())[1]?.headers).toMatchObject({
        [REPLAY_FOR_HEADER]: broker.namesOf({ consumer, type: PLACED }).durable,
      });
      expect(await broker.dead()).toEqual([]);
      expect(await billingBus.replayDead({ consumer, type: PLACED })).toBe(0);
    });

    it('moves a message that is not an envelope straight to the dead-letter stream', async () => {
      const consumer = unique('billing');
      const reported: NatsFailure[] = [];
      const bus = broker.bus({ consumer, prefetch: 1, onFailure: failuresOf(reported) });
      const billing = recorder();
      bus.subscribe(PLACED, billing.handler);
      const names = broker.namesOf({ consumer, type: PLACED });
      await bus.assertTopology();

      await broker.send(names.subject, '{"id": not json');
      await broker.send(names.subject, JSON.stringify({ id: 'evt-0' }));
      await bus.publish([anEvent('evt-1')]);
      await broker.settled(bus);
      const dead = await broker.dead();

      expect(billing.ids()).toEqual(['evt-1']);
      expect(reported).toEqual([
        { kind: 'poison', consumer: names.durable, code: POISON_MESSAGE },
        { kind: 'poison', consumer: names.durable, code: POISON_MESSAGE },
      ]);
      expect(dead.map((message) => message.body)).toEqual(['{"id": not json', '{"id":"evt-0"}']);
      expect(dead[0]?.headers).toMatchObject({
        [ERROR_CODE_HEADER]: POISON_MESSAGE,
        [DEAD_REASON_HEADER]: 'poison',
      });
    });

    it('gives every event to each consumer, and shares them between two instances of one', async () => {
      const billingName = unique('billing');
      const publisher = broker.bus();
      const billingA = broker.bus({ consumer: billingName, prefetch: 1 });
      const billingB = broker.bus({ consumer: billingName, prefetch: 1 });
      const shippingBus = broker.bus();
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
      expect(bus.describeTopology().consumers).toHaveLength(2);
    });
  });

  describe('topology', () => {
    it('describes what it creates, as data', () => {
      const bus = new NatsEventBus({ connection: url, stream: 'shop-events', consumer: 'billing.eu' });
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
  });

  describe('when the connection is lost', () => {
    it('fails fast while the server is away, then publishes and consumes again by itself', async () => {
      const network = await FaultyNetwork.to(url);
      const reported: NatsFailure[] = [];
      const bus = broker.bus({ connection: network.url, onFailure: failuresOf(reported) });
      const billing = recorder();
      bus.subscribe(PLACED, billing.handler);
      await bus.publish([anEvent('evt-1')]);
      await broker.settled(bus);

      network.refuseConnections();
      network.cutConnections();
      await eventually(() => reported.length >= 1);
      await expect(bus.publish([anEvent('evt-lost')])).rejects.toMatchObject({
        code: 'BROKER_UNAVAILABLE',
        reason: 'RECONNECTING',
      });
      network.restore();
      await eventually(() => bus.publish([anEvent('evt-2')]).then(() => true, () => false));
      await broker.settled(bus);

      expect(billing.ids()).toEqual(['evt-1', 'evt-2']);
      expect(reported[0]).toEqual({ kind: 'connection', code: 'CONNECTION_LOST' });
      await bus.close();
      await network.close();
    });

    it('receives, once back, what was published while it was away', async () => {
      const network = await FaultyNetwork.to(url);
      const publisher = broker.bus();
      const consumerBus = broker.bus({ connection: network.url });
      const billing = recorder();
      consumerBus.subscribe(PLACED, billing.handler);
      await consumerBus.assertTopology();

      network.refuseConnections();
      network.cutConnections();
      await publisher.publish([anEvent('evt-1')]);
      network.restore();
      await eventually(() => billing.received.length === 1);

      expect(billing.ids()).toEqual(['evt-1']);
      await consumerBus.close();
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

      const closing = bus.close().then(() => 'closed');
      expect(await Promise.race([closing, pause(100).then(() => 'draining')])).toBe('draining');
      finish();

      expect(await closing).toBe('closed');
      expect(done).toEqual(['evt-1']);
      expect(await broker.waitingFor(broker.namesOf({ consumer, type: PLACED }).durable)).toBe(0);
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
