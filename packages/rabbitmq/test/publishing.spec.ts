import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type RabbitMqFailure } from '../src/index.js';
import { Broker } from './support/broker.js';
import { AMQP_URL } from './support/environment.js';
import { PLACED, TRACEPARENT, anEvent } from './support/events.js';
import { FaultyNetwork } from './support/faulty-network.js';
import { failuresOf } from './support/hooks.js';
import { recorder } from './support/recorder.js';
import { unique } from './support/unique.js';
import { eventually, pause } from './support/waiting.js';

describe.skipIf(AMQP_URL === undefined)('RabbitMqEventBus: publishing', { timeout: 30_000 }, () => {
  const url = AMQP_URL ?? '';
  let broker: Broker;

  beforeEach(async () => {
    broker = await Broker.connect(url);
  });

  afterEach(async () => {
    await broker.dispose();
  });

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
