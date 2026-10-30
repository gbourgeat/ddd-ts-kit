import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Broker } from './support/broker';
import { InMemoryKafka } from './support/cluster/in-memory-kafka';
import { PLACED, anEvent } from './support/events';
import { MemoryNetwork } from './support/memory-network';

/** A fatal error of the idempotent producer is raised by the client itself: only the in-memory cluster produces one on demand. */
describe('KafkaEventBus: a fatal error of the producer, in memory', { timeout: 60_000 }, () => {
  let broker: Broker;
  let network: MemoryNetwork;

  beforeEach(async () => {
    const cluster = new InMemoryKafka();

    broker = await Broker.inMemory(cluster);
    network = new MemoryNetwork(cluster);
  });

  afterEach(async () => {
    await broker.dispose();
    await network.close();
  });

  it('rejects the publication with the code of the error, drops the producer and publishes with another', async () => {
    const bus = broker.bus({ ...network.connection });
    const topic = broker.topicOf(PLACED);

    await bus.publish([anEvent('evt-1')]);
    network.forgetProducerState();

    await expect(bus.publish([anEvent('evt-2')])).rejects.toMatchObject({
      code: 'PUBLISH_NOT_ACKNOWLEDGED',
      reason: 'ERR_UNKNOWN_PRODUCER_ID',
      eventIds: ['evt-2'],
    });

    await bus.publish([anEvent('evt-3')]);

    expect(await broker.countIn(topic)).toBe(2);
  });
});
