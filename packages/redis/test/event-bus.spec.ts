import { Redis } from 'ioredis';
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
  ATTEMPTS_EXHAUSTED,
  ATTEMPT_FIELD,
  CONSUMER_FIELD,
  DEAD_REASON_FIELD,
  ENVELOPE_FIELD,
  ERROR_CODE_FIELD,
  POISON_ENTRY,
  RedisStreamsEventBus,
  streamNamesOf,
  type RedisStreamsDelivery,
  type RedisStreamsEventBusOptions,
  type RedisStreamsFailure,
} from '../src/event-bus.js';
import { FaultyNetwork } from './support/proxy.js';
import { REAL_SERVER, SERVER_URL } from './support/server.js';
import {
  MAX_ATTEMPTS,
  RETRY_DELAY_MS,
  Server,
  anEvent,
  deliveriesOf,
  eventually,
  failuresOf,
  pause,
  unique,
} from './support/streams.js';

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

describe.skipIf(!REAL_SERVER)('RedisStreamsEventBus', { timeout: 30_000 }, () => {
  let server: Server;

  beforeEach(() => {
    server = Server.connect(SERVER_URL);
  });

  afterEach(async () => {
    await server.dispose();
  });

  /** The streams of a consumer of the test under the prefix its bus was built with. */
  const streamsOf = (prefix: string, consumer: string, type = PLACED) =>
    streamNamesOf({ consumer, type }, (eventType) => `${prefix}:${eventType}`);

  describe('publishing', () => {
    it('appends one entry to the stream of the type, identified and traceable from its fields', async () => {
      const prefix = unique('test-events');
      const event = { ...anEvent('evt-1'), version: 3, traceparent: TRACEPARENT, correlationId: 'corr-1' };

      await server.bus({ prefix }).publish([event, anEvent('evt-2', 'ordering.order.cancelled')]);
      const [entry, ...others] = await server.entries(`${prefix}:${PLACED}`);

      expect(others).toEqual([]);
      expect(entry?.fields).toEqual({
        id: 'evt-1',
        type: PLACED,
        version: '3',
        traceparent: TRACEPARENT,
        'correlation-id': 'corr-1',
        envelope: JSON.stringify(event),
      });
      expect(await server.length(`${prefix}:ordering.order.cancelled`)).toBe(1);
    });

    it('resolves only once the server acknowledged, and rejects a publication cut mid-flight', async () => {
      const network = await FaultyNetwork.to(SERVER_URL);
      const bus = server.bus({ connection: network.url });
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
      network.refuseConnections();
      network.cutConnections();

      expect(await outcome).toMatchObject({ code: 'PUBLISH_NOT_CONFIRMED', eventId: 'evt-1' });
      await network.close();
    });

    it('fails with a code, never with the URL, when the server cannot be reached', async () => {
      const network = await FaultyNetwork.to(SERVER_URL.replace('redis://', 'redis://kit:secret@'));
      const unreachable = network.url;
      await network.close();
      const reported: RedisStreamsFailure[] = [];
      const bus = server.bus({ connection: unreachable, onFailure: failuresOf(reported) });

      const failure: unknown = await bus.publish([anEvent('evt-1')]).catch((error: unknown) => error);

      expect(failure).toMatchObject({ code: 'BROKER_UNAVAILABLE', reason: 'ECONNREFUSED' });
      expect(String(failure)).not.toContain('secret');
      expect(reported[0]).toEqual({ kind: 'connection', code: 'ECONNREFUSED' });
    });

    it('appends a relay retry again by default, and only once under the publication guard', async () => {
      const [plain, guarded] = [unique('test-events'), unique('test-events')];
      const withoutGuard = server.bus({ prefix: plain });
      const withGuard = server.bus({ prefix: guarded, deduplication: { windowMs: 60_000 } });

      for (const bus of [withoutGuard, withGuard]) {
        await bus.publish([anEvent('evt-1'), anEvent('evt-2')]);
        await bus.publish([anEvent('evt-1')]);
      }

      expect(await server.length(`${plain}:${PLACED}`)).toBe(3);
      expect((await server.entries(`${guarded}:${PLACED}`)).map((entry) => entry.fields['id'])).toEqual(['evt-1', 'evt-2']);
      expect(await server.client.pttl(`${guarded}:${PLACED}:evt-1:published`)).toBeGreaterThan(50_000);
    });

    it('forgets a published id once the window of the guard has passed', async () => {
      const prefix = unique('test-events');
      const bus = server.bus({ prefix, deduplication: { windowMs: 40 } });

      await bus.publish([anEvent('evt-1')]);
      await pause(120);
      await bus.publish([anEvent('evt-1')]);

      expect(await server.length(`${prefix}:${PLACED}`)).toBe(2);
    });

    it('keeps everything by default, and trims a stream only when asked to', async () => {
      const [kept, capped, aged] = [unique('test-events'), unique('test-events'), unique('test-events')];
      const events = Array.from({ length: 400 }, (_, index) => anEvent(`evt-${String(index)}`));
      const cappedBus = server.bus({ prefix: capped, retention: { maxLength: 100 } });
      const agedBus = server.bus({ prefix: aged, retention: { maxAgeMs: 50 } });

      await server.bus({ prefix: kept }).publish(events);
      await cappedBus.publish(events);
      await cappedBus.publish(events);
      await agedBus.publish(events);
      await pause(150);
      await agedBus.publish(events);

      expect(await server.length(`${kept}:${PLACED}`)).toBe(400);
      expect(await server.length(`${capped}:${PLACED}`)).toBeLessThan(800);
      expect(await server.length(`${capped}:${PLACED}`)).toBeGreaterThanOrEqual(100);
      expect(await server.length(`${aged}:${PLACED}`)).toBeLessThan(800);
      expect(await server.length(`${aged}:${PLACED}`)).toBeGreaterThanOrEqual(400);
    });
  });

  describe('consuming', () => {
    it('carries the envelope to the handler with its trace context untouched', async () => {
      const bus = server.bus();
      const billing = recorder();
      bus.subscribe(PLACED, billing.handler);
      const event = { ...anEvent('evt-1'), traceparent: TRACEPARENT, correlationId: 'corr-1' };

      await bus.publish([event]);
      await server.settled(bus);

      expect(billing.received).toEqual([event]);
    });

    it('carries the correlation of the publishing work to the execution scope of the consumer', async () => {
      const scope = new AsyncLocalStorageExecutionScope();
      const prefix = unique('test-events');
      const bus = server.bus({ prefix });
      const seen: (ExecutionContext | undefined)[] = [];
      bus.subscribe(
        PLACED,
        inEventScope(scope, { consumer: 'billing.invoice-on-order-placed' }, async () => void seen.push(scope.current())),
      );
      const request = executionContext({ correlationId: 'corr-7', actor: systemActor('checkout'), origin: 'http' });

      await scope.run(request, () => scopedPublisher(bus, scope).publish([anEvent('evt-1')]));
      await scopedPublisher(bus, scope).publish([anEvent('evt-2')]);
      await server.settled(bus);

      expect((await server.entries(`${prefix}:${PLACED}`))[0]?.fields).toMatchObject({ id: 'evt-1', 'correlation-id': 'corr-7' });
      expect(seen).toEqual([
        { correlationId: 'corr-7', causationId: 'evt-1', actor: systemActor('billing.invoice-on-order-placed'), origin: 'event', extensions: {} },
        { correlationId: 'evt-2', causationId: 'evt-2', actor: systemActor('billing.invoice-on-order-placed'), origin: 'event', extensions: {} },
      ]);
      expect(scope.current()).toBeUndefined();
    });

    it('runs every handler inside the execution scope it was given, under the name of the consumer', async () => {
      const scope = new AsyncLocalStorageExecutionScope();
      const bus = server.bus({ scope });
      const seen: (ExecutionContext | undefined)[] = [];
      bus.forConsumer('billing').subscribe(PLACED, async () => void seen.push(scope.current()));

      await bus.publish([{ ...anEvent('evt-1'), correlationId: 'corr-7' }]);
      await server.settled(bus);

      expect(seen).toEqual([{ correlationId: 'corr-7', causationId: 'evt-1', actor: systemActor('billing'), origin: 'event', extensions: {} }]);
    });

    it('keeps the correlation across a retry: the redelivery runs in the same context', async () => {
      const scope = new AsyncLocalStorageExecutionScope();
      const bus = server.bus({ scope });
      const correlations: (string | undefined)[] = [];
      let failures = 1;
      bus.subscribe(PLACED, async () => {
        correlations.push(scope.current()?.correlationId);
        if (failures > 0) {
          failures -= 1;
          throw new InvoicingFailed();
        }
      });

      await bus.publish([{ ...anEvent('evt-1'), correlationId: 'corr-1' }]);
      await server.settled(bus);

      expect(correlations).toEqual(['corr-1', 'corr-1']);
    });

    it('delivers an event again, after the delay, when its handler failed', async () => {
      const [prefix, consumer] = [unique('test-events'), unique('billing')];
      const reported: RedisStreamsFailure[] = [];
      const settled: RedisStreamsDelivery[] = [];
      const bus = server.bus({ prefix, consumer, onFailure: failuresOf(reported), onDelivery: deliveriesOf(settled) });
      const billing = recorder(1);
      const moments: number[] = [];
      bus.subscribe(PLACED, async (event) => {
        moments.push(Date.now());
        await billing.handler(event);
      });

      await bus.publish([anEvent('evt-1')]);
      await server.settled(bus);

      expect(billing.ids()).toEqual(['evt-1', 'evt-1']);
      expect((moments[1] ?? 0) - (moments[0] ?? 0)).toBeGreaterThanOrEqual(RETRY_DELAY_MS);
      expect(settled.map(({ attempt, outcome }) => `${String(attempt)}:${outcome}`)).toEqual(['1:retried', '2:acknowledged']);
      expect(reported).toEqual([
        { kind: 'handler', stream: `${prefix}:${PLACED}`, consumer, eventId: 'evt-1', eventType: PLACED, code: 'INVOICING_FAILED', attempt: 1, dead: false },
      ]);
    });

    it('counts the retry delay from the failure, not from the delivery', async () => {
      const bus = server.bus();
      const finished: number[] = [];
      const started: number[] = [];
      let failures = 1;
      bus.subscribe(PLACED, async () => {
        started.push(Date.now());
        await pause(RETRY_DELAY_MS * 2);
        finished.push(Date.now());
        if (failures > 0) {
          failures -= 1;
          throw new InvoicingFailed();
        }
      });

      await bus.publish([anEvent('evt-1')]);
      await server.settled(bus);

      expect((started[1] ?? 0) - (finished[0] ?? 0)).toBeGreaterThanOrEqual(RETRY_DELAY_MS - 5);
    });

    it('moves an event to the dead stream once its attempts are spent, with a code and no message', async () => {
      const [prefix, consumer] = [unique('test-events'), unique('billing')];
      const reported: RedisStreamsFailure[] = [];
      const bus = server.bus({ prefix, consumer, onFailure: failuresOf(reported) });
      const billing = recorder(Number.POSITIVE_INFINITY);
      bus.subscribe(PLACED, billing.handler);
      const streams = streamsOf(prefix, consumer);

      await bus.publish([anEvent('evt-1')]);
      await server.settled(bus);
      const [original] = await server.entries(streams.events);
      const dead = await server.entries(streams.dead);

      expect(billing.received).toHaveLength(MAX_ATTEMPTS);
      expect(reported.map((failure) => failure.kind === 'handler' && failure.dead)).toEqual([false, false, true]);
      expect(dead).toHaveLength(1);
      expect(dead[0]?.fields).toMatchObject({
        id: 'evt-1',
        type: PLACED,
        [ATTEMPT_FIELD]: String(MAX_ATTEMPTS),
        [ERROR_CODE_FIELD]: 'INVOICING_FAILED',
        [DEAD_REASON_FIELD]: 'max-attempts',
        [CONSUMER_FIELD]: consumer,
        'entry-id': original?.id,
      });
      expect(JSON.parse(dead[0]?.fields[ENVELOPE_FIELD] ?? '')).toEqual(anEvent('evt-1'));
      expect(JSON.stringify([reported, dead])).not.toContain('jane.doe');
      expect(await server.pending(streams.events, consumer)).toBe(0);
    });

    it('replays dead entries with a fresh attempt budget, for the consumer they died for only', async () => {
      const [prefix, consumer] = [unique('test-events'), unique('billing')];
      const bus = server.bus({ prefix, consumer });
      const billing = recorder(MAX_ATTEMPTS);
      const shipping = recorder();
      bus.subscribe(PLACED, billing.handler);
      bus.forConsumer(unique('shipping')).subscribe(PLACED, shipping.handler);

      await bus.publish([anEvent('evt-1')]);
      await server.settled(bus);
      expect(await bus.replayDead({ consumer, type: PLACED })).toBe(1);
      expect(await bus.replayDead({ consumer, type: PLACED })).toBe(0);
      await server.settled(bus);

      expect(billing.received).toHaveLength(MAX_ATTEMPTS + 1);
      expect(shipping.ids()).toEqual(['evt-1']);
      expect(await server.length(streamsOf(prefix, consumer).dead)).toBe(0);
    });

    it('sends an entry that does not hold an envelope straight to the dead stream', async () => {
      const [prefix, consumer] = [unique('test-events'), unique('billing')];
      const reported: RedisStreamsFailure[] = [];
      const bus = server.bus({ prefix, consumer, onFailure: failuresOf(reported) });
      const billing = recorder();
      bus.subscribe(PLACED, billing.handler);
      const streams = streamsOf(prefix, consumer);
      await bus.assertTopology();

      await server.append(streams.events, { envelope: '{"id": not json' });
      await server.append(streams.events, { envelope: JSON.stringify({ id: 'evt-1' }) });
      await server.append(streams.events, { note: 'no envelope at all' });
      await eventually(async () => (await server.length(streams.dead)) === 3);
      const dead = await server.entries(streams.dead);

      expect(billing.received).toEqual([]);
      expect(reported).toEqual(Array.from({ length: 3 }, () => ({ kind: 'poison', stream: streams.events, consumer, code: POISON_ENTRY })));
      expect(dead[0]?.fields).toMatchObject({ envelope: '{"id": not json', [ERROR_CODE_FIELD]: POISON_ENTRY, [DEAD_REASON_FIELD]: 'poison' });
      expect(await server.pending(streams.events, consumer)).toBe(0);
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

    it('takes over what an instance that died left pending, once the visibility timeout has passed', async () => {
      const [prefix, consumer] = [unique('test-events'), unique('billing')];
      const settled: RedisStreamsDelivery[] = [];
      const streams = streamsOf(prefix, consumer);
      const publisher = server.bus({ prefix });
      await server.client.xgroup('CREATE', streams.events, consumer, '$', 'MKSTREAM');
      await publisher.publish([anEvent('evt-1')]);
      await server.client.xreadgroup('GROUP', consumer, 'an-instance-that-died', 'COUNT', 10, 'STREAMS', streams.events, '>');
      const survivor = server.bus({ prefix, consumer, visibilityTimeoutMs: 150, onDelivery: deliveriesOf(settled) });
      const billing = recorder();
      const started = Date.now();

      survivor.subscribe(PLACED, billing.handler);
      await server.settled(survivor);

      expect(billing.ids()).toEqual(['evt-1']);
      expect(Date.now() - started).toBeGreaterThanOrEqual(100);
      expect(settled).toEqual([{ stream: streams.events, consumer, attempt: 2, outcome: 'acknowledged' }]);
    });

    it('buries, without handling it again, an entry whose deliveries were all lost to crashes', async () => {
      const [prefix, consumer] = [unique('test-events'), unique('billing')];
      const reported: RedisStreamsFailure[] = [];
      const streams = streamsOf(prefix, consumer);
      await server.client.xgroup('CREATE', streams.events, consumer, '$', 'MKSTREAM');
      await server.bus({ prefix }).publish([anEvent('evt-1')]);
      await server.client.xreadgroup('GROUP', consumer, 'crashed-1', 'COUNT', 10, 'STREAMS', streams.events, '>');
      const [entry] = await server.entries(streams.events);
      for (const crashed of ['crashed-2', 'crashed-3']) {
        await server.client.xclaim(streams.events, consumer, crashed, 0, entry?.id ?? '');
      }
      const survivor = server.bus({ prefix, consumer, visibilityTimeoutMs: 50, onFailure: failuresOf(reported) });
      const billing = recorder();

      survivor.subscribe(PLACED, billing.handler);
      await eventually(async () => (await server.length(streams.dead)) === 1);

      expect(billing.received).toEqual([]);
      expect(reported).toEqual([expect.objectContaining({ kind: 'handler', code: ATTEMPTS_EXHAUSTED, attempt: MAX_ATTEMPTS + 1, dead: true })]);
      expect(await server.pending(streams.events, consumer)).toBe(0);
    });
  });

  describe('topology', () => {
    it('declares it idempotently: a group that exists keeps its position', async () => {
      const [prefix, consumer] = [unique('test-events'), unique('billing')];
      const bus = server.bus({ prefix, consumer });
      const billing = recorder();
      bus.subscribe(PLACED, billing.handler);

      await bus.assertTopology();
      await bus.publish([anEvent('evt-1')]);
      await server.settled(bus);
      await bus.assertTopology();
      await server.settled(bus);

      expect(billing.ids()).toEqual(['evt-1']);
      expect(await server.consumers(`${prefix}:${PLACED}`, consumer)).toBe(1);
    });

    it('starts a new consumer at the events published from then on, or at the beginning when asked to', async () => {
      const prefix = unique('test-events');
      const publisher = server.bus({ prefix });
      await publisher.publish([anEvent('evt-1')]);
      const latecomer = server.bus({ prefix });
      const historian = server.bus({ prefix, startFrom: 'beginning' });
      const [late, whole] = [recorder(), recorder()];
      latecomer.subscribe(PLACED, late.handler);
      historian.subscribe(PLACED, whole.handler);
      await Promise.all([latecomer.assertTopology(), historian.assertTopology()]);

      await publisher.publish([anEvent('evt-2')]);
      await Promise.all([server.settled(latecomer), server.settled(historian)]);

      expect(late.ids()).toEqual(['evt-2']);
      expect(whole.ids()).toEqual(['evt-1', 'evt-2']);
    });

    it('creates its groups again when the server lost them, and resumes consuming', async () => {
      const [prefix, consumer] = [unique('test-events'), unique('billing')];
      const reported: RedisStreamsFailure[] = [];
      const bus = server.bus({ prefix, consumer, onFailure: failuresOf(reported) });
      const billing = recorder();
      bus.subscribe(PLACED, billing.handler);
      await bus.publish([anEvent('evt-1')]);
      await server.settled(bus);

      await server.client.del(`${prefix}:${PLACED}`);
      await eventually(() => reported.length > 0);
      await eventually(async () => (await server.consumers(`${prefix}:${PLACED}`, consumer)) === 1);
      await bus.publish([anEvent('evt-2')]);
      await server.settled(bus);

      expect(billing.ids()).toEqual(['evt-1', 'evt-2']);
      expect(reported[0]).toMatchObject({ kind: 'connection', code: expect.stringMatching(/^REDIS_(NOGROUP|ERR)$/) });
    });
  });

  describe('when the connection is lost', () => {
    it('reconnects and resumes consuming', async () => {
      const network = await FaultyNetwork.to(SERVER_URL);
      const reported: RedisStreamsFailure[] = [];
      const bus = server.bus({ connection: network.url, onFailure: failuresOf(reported) });
      const billing = recorder();
      bus.subscribe(PLACED, billing.handler);
      await bus.publish([anEvent('evt-1')]);
      await server.settled(bus);

      network.refuseConnections();
      network.cutConnections();
      await eventually(() => reported.length >= 2);
      await expect(bus.publish([anEvent('evt-lost')])).rejects.toMatchObject({ code: 'BROKER_UNAVAILABLE' });
      network.restore();
      await eventually(() => bus.publish([anEvent('evt-2')]).then(() => true, () => false));
      await server.settled(bus);

      expect(billing.ids()).toEqual(['evt-1', 'evt-2']);
      expect(reported[0]).toEqual({ kind: 'connection', code: 'CONNECTION_LOST' });
      await network.close();
    });

    it('receives, once back, what was published while it was away', async () => {
      const network = await FaultyNetwork.to(SERVER_URL);
      const prefix = unique('test-events');
      const publisher = server.bus({ prefix });
      const consumerBus = server.bus({ prefix, connection: network.url });
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
      const [prefix, consumer] = [unique('test-events'), unique('billing')];
      const bus = server.bus({ prefix, consumer });
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
      expect(await server.pending(`${prefix}:${PLACED}`, consumer)).toBe(0);
      expect(await server.consumers(`${prefix}:${PLACED}`, consumer)).toBe(0);
    });

    it('stays a member of its group when it leaves an entry pending, for another instance to claim it', async () => {
      const [prefix, consumer] = [unique('test-events'), unique('billing')];
      const bus = server.bus({ prefix, consumer, retry: { delayMs: 60_000 } });
      const billing = recorder(1);
      bus.subscribe(PLACED, billing.handler);
      await bus.publish([anEvent('evt-1')]);
      await eventually(() => billing.received.length === 1 && bus.deliveriesInFlight === 0);

      await bus.close();

      expect(await server.pending(`${prefix}:${PLACED}`, consumer)).toBe(1);
      expect(await server.consumers(`${prefix}:${PLACED}`, consumer)).toBe(1);
    });

    it('refuses to publish or subscribe once closed', async () => {
      const bus = server.bus();
      await bus.publish([anEvent('evt-1')]);

      await bus.close();
      await bus.close();

      await expect(bus.publish([anEvent('evt-2')])).rejects.toMatchObject({ code: 'EVENT_BUS_CLOSED' });
      expect(() => bus.subscribe(PLACED, async () => undefined)).toThrow(expect.objectContaining({ code: 'EVENT_BUS_CLOSED' }));
    });

    it('leaves open a client it was handed, and closes only the readers it duplicated from it', async () => {
      const mine = new Redis(SERVER_URL, { maxRetriesPerRequest: 1 });
      const bus = server.bus({ connection: mine });
      const billing = recorder();
      bus.subscribe(PLACED, billing.handler);
      await bus.publish([anEvent('evt-1')]);
      await server.settled(bus);

      await bus.close();

      expect(billing.ids()).toEqual(['evt-1']);
      expect(await mine.ping()).toBe('PONG');
      mine.disconnect();
    });
  });
});

describe('RedisStreamsEventBus while the server is away', () => {
  const nowhere = 'redis://kit:secret@127.0.0.1:1';
  const buses: RedisStreamsEventBus[] = [];
  const busTo = (options: Partial<RedisStreamsEventBusOptions> = {}): RedisStreamsEventBus => {
    const bus = new RedisStreamsEventBus({ connection: nowhere, reconnect: { initialMs: 20, maxMs: 50 }, ...options });
    buses.push(bus);
    return bus;
  };

  afterEach(async () => {
    await Promise.all(buses.splice(0).map((bus) => bus.close()));
  });

  it('needs a consumer name to subscribe', () => {
    const anonymous = busTo();

    expect(() => anonymous.subscribe(PLACED, async () => undefined)).toThrow(expect.objectContaining({ code: 'CONSUMER_NAME_REQUIRED' }));
    expect(() => anonymous.forConsumer('')).toThrow(expect.objectContaining({ code: 'CONSUMER_NAME_REQUIRED' }));
  });

  it('describes what it creates, as data', () => {
    const bus = busTo({ prefix: 'shop-events', consumer: 'billing', retention: { maxLength: 100_000 } });
    bus.subscribe(PLACED, async () => undefined);
    bus.forConsumer('shipping').subscribe(PLACED, async () => undefined);

    expect(bus.describeTopology()).toEqual({
      streams: [
        { name: 'shop-events:ordering.order.placed', role: 'events', type: PLACED, retention: { maxLength: 100_000 } },
        { name: 'shop-events:ordering.order.placed:billing:dead', role: 'dead', type: PLACED, consumer: 'billing' },
        { name: 'shop-events:ordering.order.placed:shipping:dead', role: 'dead', type: PLACED, consumer: 'shipping' },
      ],
      groups: [
        { stream: 'shop-events:ordering.order.placed', name: 'billing', startFrom: 'new' },
        { stream: 'shop-events:ordering.order.placed', name: 'shipping', startFrom: 'new' },
      ],
    });
    expect(streamNamesOf({ consumer: 'billing', type: PLACED })).toEqual({
      events: 'integration-events:ordering.order.placed',
      dead: 'integration-events:ordering.order.placed:billing:dead',
    });
  });

  it('rejects a publication with a code, never with the URL, and reports the connection failures as codes', async () => {
    const reported: RedisStreamsFailure[] = [];
    const bus = busTo({ consumer: 'billing', onFailure: failuresOf(reported) });
    bus.subscribe(PLACED, async () => undefined);

    const failure: unknown = await bus.publish([anEvent('evt-1')]).catch((error: unknown) => error);
    await eventually(() => reported.length >= 3);

    expect(failure).toMatchObject({ code: 'BROKER_UNAVAILABLE', reason: 'ECONNREFUSED' });
    expect(String(failure)).not.toContain('secret');
    expect(new Set(reported.map((entry) => JSON.stringify(entry)))).toEqual(new Set(['{"kind":"connection","code":"ECONNREFUSED"}']));
    await expect(bus.assertTopology()).rejects.toMatchObject({ code: 'BROKER_UNAVAILABLE' });
  });

  it('closes at once, although it never connected', async () => {
    const bus = busTo({ consumer: 'billing' });
    bus.subscribe(PLACED, async () => undefined);
    await bus.publish([anEvent('evt-1')]).catch(() => undefined);

    expect(await Promise.race([bus.close().then(() => 'closed'), pause(1_000).then(() => 'hanging')])).toBe('closed');
  });
});
