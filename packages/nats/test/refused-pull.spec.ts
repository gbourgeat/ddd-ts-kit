import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { NatsFailure } from '../src';
import { Broker } from './support/broker';
import { PLACED, anEvent } from './support/events';
import { FaultyNetwork } from './support/faulty-network';
import { gate } from './support/gate';
import { failuresOf } from './support/hooks';
import { InvoicingFailed } from './support/invoicing-failed';
import { recorder } from './support/recorder';
import { eventually } from './support/waiting';

// The in-memory server alone: a real one has no way to refuse a valid pull on demand.
describe('NatsEventBus: a pull the server refuses', { timeout: 30_000 }, () => {
  let broker: Broker;

  beforeEach(async () => {
    broker = await Broker.inMemory();
  });

  afterEach(async () => {
    await broker.dispose();
  });

  it('reports the failure of the connection, then consumes again by itself', async () => {
    const reported: NatsFailure[] = [];
    const bus = broker.bus({ onFailure: failuresOf(reported) });
    const billing = recorder();

    bus.subscribe(PLACED, billing.handler);
    await bus.publish([anEvent('evt-1')]);
    await eventually(() => billing.ids().includes('evt-1'));

    const [consumer] = bus.describeTopology().consumers;

    broker.refusePullsOf(consumer?.name ?? '');
    await eventually(() => reported.some((failure) => failure.kind === 'connection'));

    await eventually(() =>
      bus.publish([anEvent('evt-2')]).then(
        () => true,
        () => false,
      ),
    );

    await eventually(() => billing.ids().includes('evt-2'));

    expect(reported[0]).toMatchObject({ kind: 'connection' });
  });

  it('writes no dead letter on a connection that left under it, and comes back all the same', async () => {
    const network = await FaultyNetwork.to(broker.url);
    const reported: NatsFailure[] = [];
    const entered = gate();
    const finish = gate();

    const bus = broker.bus({
      connection: network.url,
      onFailure: failuresOf(reported),
      retry: { delayMs: 20, maxAttempts: 1 },
    });

    bus.subscribe(PLACED, async () => {
      entered.open();
      await finish.opened;
      throw new InvoicingFailed();
    });

    await bus.publish([anEvent('evt-1')]);
    await entered.opened;

    const [consumer] = bus.describeTopology().consumers;

    network.refuseConnections();
    broker.refusePullsOf(consumer?.name ?? '');

    await eventually(() =>
      reported.some((failure) => failure.kind === 'connection' && failure.code === 'CONNECTION_CLOSED'),
    );

    finish.open();
    await eventually(() => reported.some((failure) => failure.kind === 'handler'));

    expect(await broker.dead()).toEqual([]);

    network.restore();

    await eventually(() =>
      bus.publish([anEvent('evt-2')]).then(
        () => true,
        () => false,
      ),
    );

    await network.close();
  });
});
