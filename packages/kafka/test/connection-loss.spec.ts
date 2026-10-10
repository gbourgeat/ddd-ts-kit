import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Broker } from './support/broker.js';
import { KAFKA_BROKERS, KAFKA_RELAY } from './support/environment.js';
import { PLACED, anEvent } from './support/events.js';
import { FaultyNetwork } from './support/faulty-network.js';
import { recorder } from './support/recorder.js';
import { eventually, pause } from './support/waiting.js';

describe.skipIf(KAFKA_BROKERS === undefined || KAFKA_RELAY === undefined)('KafkaEventBus: when the connection is lost', { timeout: 60_000 }, () => {
  let broker: Broker;
  let relay: FaultyNetwork | undefined;

  beforeEach(async () => {
    broker = await Broker.connect(KAFKA_BROKERS ?? '');
  });

  // The buses leave their groups before the relay goes: a client cut off from the cluster
  // takes its session timeout to close.
  afterEach(async () => {
    relay?.restore();
    await broker.dispose();
    await relay?.close();
    relay = undefined;
  }, 30_000);

  const relayed = async (): Promise<FaultyNetwork> => {
    relay = await FaultyNetwork.from(KAFKA_RELAY ?? '');

    return relay;
  };

  it('resolves only once the broker acknowledged, and rejects a publication cut mid-flight', async () => {
    const network = await relayed();
    const bus = broker.bus({ brokers: network.brokers, publishTimeoutMs: 1_500 });

    await bus.publish([anEvent('evt-0')]);

    network.holdReplies();
    const sent = network.bytesFromClient;
    const publication = bus.publish([anEvent('evt-1'), anEvent('evt-2')]);

    const outcome = publication.then(
      () => 'acknowledged',
      (error: unknown) => error,
    );

    await eventually(() => network.bytesFromClient > sent);
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
    const network = await relayed();
    const bus = broker.bus({ brokers: network.brokers, publishTimeoutMs: 1_000 });
    const billing = recorder();

    bus.subscribe(PLACED, billing.handler);
    await bus.publish([anEvent('evt-1')]);
    await broker.settled(bus);

    network.refuseConnections();
    network.cutConnections();
    await expect(bus.publish([anEvent('evt-lost')])).rejects.toMatchObject({ code: 'PUBLISH_NOT_ACKNOWLEDGED' });
    network.restore();
    await eventually(() => bus.publish([anEvent('evt-2')]).then(() => true, () => false));
    await broker.settled(bus);

    expect([...new Set(billing.ids())]).toEqual(['evt-1', 'evt-2']);
  });

  it('receives, once back, what was published while it was away', async () => {
    const network = await relayed();
    const publisher = broker.bus();
    const consumerBus = broker.bus({ brokers: network.brokers });
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
});
