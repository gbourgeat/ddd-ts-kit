import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type RabbitMqFailure } from '../src';
import type { Broker } from './support/broker';
import { BROKERS } from './support/brokers';
import { PLACED, TRACEPARENT, anEvent } from './support/events';
import { failuresOf } from './support/hooks';
import { recorder } from './support/recorder';
import { unique } from './support/unique';
import { eventually, pause } from './support/waiting';

describe.each(BROKERS)('RabbitMqEventBus: publishing, %s', { timeout: 30_000 }, (_name, connect) => {
  let broker: Broker;

  beforeEach(async () => {
    broker = await connect();
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
    const network = await broker.network();
    const bus = broker.bus({ connection: network.connection });

    await bus.assertTopology();

    network.holdReplies();
    const sent = network.traffic;
    const publication = bus.publish([anEvent('evt-1'), anEvent('evt-2')]);

    const outcome = publication.then(
      () => 'confirmed',
      (error: unknown) => error,
    );

    await eventually(() => network.traffic > sent);
    expect(await Promise.race([outcome, pause(100).then(() => 'still waiting')])).toBe('still waiting');
    network.cutConnections();

    expect(await outcome).toMatchObject({ code: 'PUBLISH_NOT_CONFIRMED' });
    await network.close();
  });

  it('rejects a publication the broker does not confirm in time, the connection left as it is', async () => {
    const network = await broker.network();
    const bus = broker.bus({ connection: network.connection, publishTimeoutMs: 200 });

    await bus.assertTopology();
    network.holdReplies();

    await expect(bus.publish([anEvent('evt-1')])).rejects.toMatchObject({ code: 'PUBLISH_NOT_CONFIRMED' });
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
    const network = await broker.network();
    const unreachable = network.connection;

    await network.close();
    const reported: RabbitMqFailure[] = [];
    const bus = broker.bus({ connection: unreachable, onFailure: failuresOf(reported) });

    const failure: unknown = await bus.publish([anEvent('evt-1')]).catch((error: unknown) => error);

    expect(failure).toMatchObject({ code: 'BROKER_UNAVAILABLE', reason: 'ECONNREFUSED' });
    expect(String(failure)).not.toContain('kit');
    expect(reported).toEqual([{ kind: 'connection', code: 'ECONNREFUSED' }]);
  });

  it('publishes nothing, and connects to nothing, for no event', async () => {
    const network = await broker.network();
    const unreachable = network.connection;

    await network.close();
    const reported: RabbitMqFailure[] = [];
    const bus = broker.bus({ connection: unreachable, onFailure: failuresOf(reported) });

    expect(await bus.publish([])).toBeUndefined();
    expect(reported).toEqual([]);
  });
});
