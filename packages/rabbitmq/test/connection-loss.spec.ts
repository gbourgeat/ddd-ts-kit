import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type RabbitMqFailure } from '../src/index.js';
import { Broker } from './support/broker.js';
import { AMQP_URL } from './support/environment.js';
import { PLACED, anEvent } from './support/events.js';
import { FaultyNetwork } from './support/faulty-network.js';
import { failuresOf } from './support/hooks.js';
import { recorder } from './support/recorder.js';
import { unique } from './support/unique.js';
import { eventually } from './support/waiting.js';

describe.skipIf(AMQP_URL === undefined)('RabbitMqEventBus: when the connection is lost', { timeout: 30_000 }, () => {
  const url = AMQP_URL ?? '';
  let broker: Broker;

  beforeEach(async () => {
    broker = await Broker.connect(url);
  });

  afterEach(async () => {
    await broker.dispose();
  });

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

    await eventually(() =>
      bus.publish([anEvent('evt-2')]).then(
        () => true,
        () => false,
      ),
    );

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
