import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { queueNamesOf, type RabbitMqFailure } from '../src';
import type { Broker } from './support/broker';
import { BROKERS } from './support/brokers';
import { PLACED, anEvent } from './support/events';
import { InvoicingFailed } from './support/invoicing-failed';
import { failuresOf } from './support/hooks';
import { recorder } from './support/recorder';
import { unique } from './support/unique';
import { eventually } from './support/waiting';

describe.each(BROKERS)('RabbitMqEventBus: when the connection is lost, %s', { timeout: 30_000 }, (_name, connect) => {
  let broker: Broker;

  beforeEach(async () => {
    broker = await connect();
  });

  afterEach(async () => {
    await broker.dispose();
  });

  it('reconnects, declares its topology again and resumes consuming', async () => {
    const network = await broker.network();
    const reported: RabbitMqFailure[] = [];
    const bus = broker.bus({ connection: network.connection, onFailure: failuresOf(reported) });
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
    const network = await broker.network();
    const exchange = unique('test-events');
    const publisher = broker.bus({ exchange });
    const consumerBus = broker.bus({ exchange, connection: network.connection });
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

  it('starts again when the broker cancels its consumer, its queue deleted', async () => {
    const consumer = unique('billing');
    const reported: RabbitMqFailure[] = [];
    const bus = broker.bus({ consumer, onFailure: failuresOf(reported) });
    const billing = recorder();

    bus.subscribe(PLACED, billing.handler);
    await bus.publish([anEvent('evt-1')]);
    await broker.settled(bus);

    await broker.deleteQueue(queueNamesOf({ consumer, type: PLACED }).work);
    await eventually(() => reported.some((failure) => failure.kind === 'connection'));

    await eventually(() =>
      bus.assertTopology().then(
        () => true,
        () => false,
      ),
    );

    await bus.publish([anEvent('evt-2')]);
    await broker.settled(bus);

    expect(billing.ids()).toEqual(['evt-1', 'evt-2']);
    expect(reported[0]).toEqual({ kind: 'connection', code: 'CONNECTION_LOST' });
  });

  it('gets a message again when its handler finished after the connection dropped', async () => {
    const network = await broker.network();
    const consumer = unique('billing');
    const bus = broker.bus({ consumer, connection: network.connection });
    const handled: string[] = [];
    let release: () => void = () => undefined;

    const released = new Promise<void>((resolve) => {
      release = resolve;
    });

    bus.subscribe(PLACED, async (event) => {
      handled.push(event.id);

      if (handled.length === 1) {
        await released;
        throw new InvoicingFailed();
      }
    });

    await bus.publish([anEvent('evt-1')]);
    await eventually(() => bus.deliveriesInFlight === 1);
    network.cutConnections();
    release();
    // Reported as retried, the failure never reached the retry queue: the broker redelivers it.
    await eventually(() => handled.length === 2 && bus.deliveriesInFlight === 0);
    broker.remember(bus);

    expect(handled).toEqual(['evt-1', 'evt-1']);
    expect(await broker.readyIn(queueNamesOf({ consumer, type: PLACED }).retry)).toBe(0);
    await network.close();
  });
});

describe.each(BROKERS)('RabbitMqEventBus: when the connection drops under a publication, %s', (_name, connect) => {
  let broker: Broker;

  beforeEach(async () => {
    broker = await connect();
  });

  afterEach(async () => {
    await broker.dispose();
  });

  it('rejects a publication the connection dropped under, before it reached the channel', async () => {
    const network = await broker.network();
    const bus = broker.bus({ connection: network.connection });

    await bus.publish([anEvent('evt-1')]);

    const publication = bus.publish([anEvent('evt-2')]).then(
      () => 'published',
      (error: unknown) => error,
    );

    network.cutConnections();

    expect(await publication).toMatchObject({ code: 'BROKER_UNAVAILABLE', reason: 'RECONNECTING' });
    await network.close();
  });
});
