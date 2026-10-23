import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RedisStreamsFailure } from '../src/event-bus';
import { PLACED, TRACEPARENT, anEvent, failuresOf, unique } from './support/events';
import { FaultyNetwork } from './support/proxy';
import { SERVERS, serverOf } from './support/servers';
import { Server } from './support/streams';
import { eventually, pause } from './support/waiting';

describe.each(SERVERS)('RedisStreamsEventBus, publishing, %s', { timeout: 30_000 }, (_name, start) => {
  const redis = serverOf(start);

  let server: Server;

  beforeEach(() => {
    server = Server.connect(redis.url);
  });

  afterEach(async () => {
    await server.dispose();
  });

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
    const network = await FaultyNetwork.to(redis.url);
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
    const network = await FaultyNetwork.to(redis.url.replace('redis://', 'redis://kit:secret@'));
    const unreachable = network.url;

    await network.close();
    const reported: RedisStreamsFailure[] = [];
    const bus = server.bus({ connection: unreachable, onFailure: failuresOf(reported) });

    const failure: unknown = await bus.publish([anEvent('evt-1')]).catch((error: unknown) => error);

    expect(failure).toMatchObject({ code: 'BROKER_UNAVAILABLE', reason: 'ECONNREFUSED' });
    expect(String(failure)).not.toContain('secret');
    expect(reported[0]).toEqual({ kind: 'connection', code: 'ECONNREFUSED' });
  });
});
