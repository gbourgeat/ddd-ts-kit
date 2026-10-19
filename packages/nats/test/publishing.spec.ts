import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type NatsFailure } from '../src/index.js';
import type { Broker } from './support/broker.js';
import { BROKERS } from './support/brokers.js';
import { PLACED, TRACEPARENT, anEvent } from './support/events.js';
import { FaultyNetwork } from './support/faulty-network.js';
import { failuresOf } from './support/hooks.js';
import { recorder } from './support/recorder.js';
import { eventually, pause } from './support/waiting.js';

describe.each(BROKERS)('NatsEventBus: publishing, %s', { timeout: 30_000 }, (_name, connect) => {
  let broker: Broker;

  beforeEach(async () => {
    broker = await connect();
  });

  afterEach(async () => {
    await broker.dispose();
  });

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
    const network = await FaultyNetwork.to(broker.url);
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
    const network = await FaultyNetwork.to(broker.url);
    const unreachable = network.url;

    await network.close();
    const reported: NatsFailure[] = [];
    const bus = broker.bus({ connection: unreachable, onFailure: failuresOf(reported) });

    const failure: unknown = await bus.publish([anEvent('evt-1')]).catch((error: unknown) => error);

    expect(failure).toMatchObject({ code: 'BROKER_UNAVAILABLE', reason: 'ECONNREFUSED' });
    expect(String(failure)).not.toContain('127.0.0.1');
    expect(reported).toEqual([{ kind: 'connection', code: 'ECONNREFUSED' }]);
  });

  it('publishes nothing, and connects to nothing, for no event', async () => {
    const network = await FaultyNetwork.to(broker.url);
    const unreachable = network.url;

    await network.close();
    const reported: NatsFailure[] = [];
    const bus = broker.bus({ connection: unreachable, onFailure: failuresOf(reported) });

    expect(await bus.publish([])).toBeUndefined();
    expect(reported).toEqual([]);
  });
});
