import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RedisStreamsFailure } from '../src/event-bus';
import { PLACED, anEvent, failuresOf, recorder, unique } from './support/events';
import { FaultyNetwork } from './support/proxy';
import { REAL_SERVER, SERVER_URL } from './support/server';
import { Server } from './support/streams';
import { eventually } from './support/waiting';

describe.skipIf(!REAL_SERVER)('RedisStreamsEventBus, when the connection is lost', { timeout: 30_000 }, () => {
  let server: Server;

  beforeEach(() => {
    server = Server.connect(SERVER_URL);
  });

  afterEach(async () => {
    await server.dispose();
  });

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

    await eventually(() =>
      bus.publish([anEvent('evt-2')]).then(
        () => true,
        () => false,
      ),
    );

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
