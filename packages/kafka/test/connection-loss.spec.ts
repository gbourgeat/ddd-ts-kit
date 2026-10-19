import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { KafkaFailure } from '../src/index.js';
import type { Broker } from './support/broker.js';
import { NETWORKED_BROKERS } from './support/brokers.js';
import { PLACED, anEvent } from './support/events.js';
import { failuresOf } from './support/hooks.js';
import type { Network } from './support/network.js';
import { recorder } from './support/recorder.js';
import { eventually, pause } from './support/waiting.js';

interface SabotagedSuite {
  readonly broker: Broker;
  relayed(): Promise<Network>;
}

/**
 * The broker of each test and the network it sabotages. The buses leave their groups before the
 * network goes: a client cut off from the cluster takes its session timeout to close.
 */
function onASabotagedNetwork(connect: () => Promise<Broker>): SabotagedSuite {
  let current: Broker | undefined;
  let relay: Network | undefined;

  beforeEach(async () => {
    current = await connect();
  });

  afterEach(async () => {
    relay?.restore();
    await current?.dispose();
    await relay?.close();
    relay = undefined;
  }, 30_000);

  const suite: SabotagedSuite = {
    get broker(): Broker {
      if (current === undefined) {
        throw new Error('No broker outside a test');
      }

      return current;
    },
    async relayed(): Promise<Network> {
      relay = await suite.broker.network();

      return relay;
    },
  };

  return suite;
}

describe.each(NETWORKED_BROKERS)(
  'KafkaEventBus: publishing when the connection is lost, %s',
  { timeout: 60_000 },
  (_name, connect) => {
    const suite = onASabotagedNetwork(connect);

    it('resolves only once the broker acknowledged, and rejects a publication cut mid-flight', async () => {
      const network = await suite.relayed();
      const bus = suite.broker.bus({ ...network.connection, publishTimeoutMs: 1_500 });

      await bus.publish([anEvent('evt-0')]);

      network.holdReplies();
      const sent = network.traffic;
      const publication = bus.publish([anEvent('evt-1'), anEvent('evt-2')]);

      const outcome = publication.then(
        () => 'acknowledged',
        (error: unknown) => error,
      );

      await eventually(() => network.traffic > sent);
      expect(await Promise.race([outcome, pause(300).then(() => 'still waiting')])).toBe('still waiting');
      network.refuseConnections();
      network.cutConnections();

      expect(await outcome).toMatchObject({
        code: 'PUBLISH_NOT_ACKNOWLEDGED',
        reason: 'ERR__MSG_TIMED_OUT',
        eventIds: ['evt-1', 'evt-2'],
      });
    });

    it('rejects while the cluster is away, then publishes and consumes again by itself', async () => {
      const network = await suite.relayed();
      const bus = suite.broker.bus({ ...network.connection, publishTimeoutMs: 1_000 });
      const billing = recorder();

      bus.subscribe(PLACED, billing.handler);
      await bus.publish([anEvent('evt-1')]);
      await suite.broker.settled(bus);

      network.refuseConnections();
      network.cutConnections();
      await expect(bus.publish([anEvent('evt-lost')])).rejects.toMatchObject({ code: 'PUBLISH_NOT_ACKNOWLEDGED' });
      network.restore();

      await eventually(() =>
        bus.publish([anEvent('evt-2')]).then(
          () => true,
          () => false,
        ),
      );

      await suite.broker.settled(bus);

      expect([...new Set(billing.ids())]).toEqual(['evt-1', 'evt-2']);
    });
  },
);

describe.each(NETWORKED_BROKERS)(
  'KafkaEventBus: consuming when the connection is lost, %s',
  { timeout: 60_000 },
  (_name, connect) => {
    const suite = onASabotagedNetwork(connect);

    it('receives, once back, what was published while it was away', async () => {
      const network = await suite.relayed();
      const publisher = suite.broker.bus();
      const consumerBus = suite.broker.bus(network.connection);
      const billing = recorder();

      consumerBus.subscribe(PLACED, billing.handler);
      await consumerBus.assertTopology();

      network.refuseConnections();
      network.cutConnections();
      await publisher.publish([anEvent('evt-1')]);
      network.restore();
      await eventually(() => billing.received.length >= 1, 30_000);

      expect([...new Set(billing.ids())]).toEqual(['evt-1']);
    });

    it('joins its group once the cluster is back, after a start that failed', async () => {
      const network = await suite.relayed();
      const reported: KafkaFailure[] = [];
      const bus = suite.broker.bus({ ...network.connection, connectTimeoutMs: 500, onFailure: failuresOf(reported) });
      const billing = recorder();

      network.refuseConnections();
      bus.subscribe(PLACED, billing.handler);
      await eventually(() => reported.some((failure) => failure.kind === 'connection'), 30_000);
      network.restore();

      await eventually(
        () =>
          bus.assertTopology().then(
            () => true,
            () => false,
          ),
        30_000,
      );

      await bus.publish([anEvent('evt-1')]);
      await suite.broker.settled(bus);

      expect([...new Set(billing.ids())]).toEqual(['evt-1']);
    });

    it('reads a record again when its offset could not be committed while the cluster was away', async () => {
      const network = await suite.relayed();
      const bus = suite.broker.bus(network.connection);
      const handled: string[] = [];
      let release: () => void = () => undefined;

      const released = new Promise<void>((resolve) => {
        release = resolve;
      });

      bus.subscribe(PLACED, async (event) => {
        handled.push(event.id);

        if (handled.length === 1) {
          await released;
        }
      });

      await bus.publish([anEvent('evt-1')]);
      await eventually(() => bus.deliveriesInFlight === 1, 30_000);
      network.refuseConnections();
      network.cutConnections();
      release();
      await pause(300);
      network.restore();
      await suite.broker.settled(bus);

      expect([...new Set(handled)]).toEqual(['evt-1']);
    });
  },
);
