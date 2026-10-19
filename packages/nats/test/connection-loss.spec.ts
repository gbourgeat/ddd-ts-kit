import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type NatsFailure } from '../src/index.js';
import type { Broker } from './support/broker.js';
import { BROKERS } from './support/brokers.js';
import { PLACED, anEvent } from './support/events.js';
import { FaultyNetwork } from './support/faulty-network.js';
import { failuresOf } from './support/hooks.js';
import { recorder } from './support/recorder.js';
import { eventually } from './support/waiting.js';

describe.each(BROKERS)('NatsEventBus: when the connection is lost, %s', { timeout: 30_000 }, (_name, connect) => {
  let broker: Broker;

  beforeEach(async () => {
    broker = await connect();
  });

  afterEach(async () => {
    await broker.dispose();
  });

  it('fails fast while the server is away, then publishes and consumes again by itself', async () => {
    const network = await FaultyNetwork.to(broker.url);
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

    await eventually(() =>
      bus.publish([anEvent('evt-2')]).then(
        () => true,
        () => false,
      ),
    );

    await broker.settled(bus);

    expect(billing.ids()).toEqual(['evt-1', 'evt-2']);
    expect(reported[0]).toEqual({ kind: 'connection', code: 'CONNECTION_LOST' });
    await bus.close();
    await network.close();
  });

  it('receives, once back, what was published while it was away', async () => {
    const network = await FaultyNetwork.to(broker.url);
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
