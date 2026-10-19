import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { KafkaEventBus, deadTopicOf } from '../src/index.js';
import type { Broker } from './support/broker.js';
import { InMemoryKafka } from './support/cluster/in-memory-kafka.js';
import { BROKERS } from './support/brokers.js';
import { PLACED } from './support/events.js';

describe.each(BROKERS)('KafkaEventBus: topology, %s', { timeout: 60_000 }, (_name, connect) => {
  let broker: Broker;

  beforeEach(async () => {
    broker = await connect();
  });

  afterEach(async () => {
    await broker.dispose();
  }, 30_000);

  it('describes what it creates and joins, as data', async () => {
    // A cluster of its own: the subscription connects in the background, and nothing is left behind.
    const bus = new KafkaEventBus({
      brokers: '127.0.0.1:1',
      cluster: new InMemoryKafka(),
      consumer: 'billing',
      publishedTypes: ['billing.invoice.issued'],
      topics: { partitions: 6, replicationFactor: 3 },
    });

    bus.subscribe(PLACED, async () => undefined);
    const sized = { partitions: 6, replicationFactor: 3 };

    expect(bus.describeTopology()).toEqual({
      topics: [
        { name: 'billing.invoice.issued', role: 'events', ...sized },
        { name: 'ordering.order.placed', role: 'events', ...sized },
        { name: 'billing.ordering.order.placed.dead', role: 'dead', ...sized },
      ],
      groups: [{ groupId: 'billing', topics: ['ordering.order.placed'] }],
    });

    await bus.close();
  });

  it('creates it idempotently', async () => {
    const consumer = broker.consumer('billing');
    const bus = broker.bus({ consumer, publishedTypes: ['billing.invoice.issued'], topics: { partitions: 2 } });

    bus.subscribe(PLACED, async () => undefined);

    await bus.assertTopology();
    await bus.assertTopology();
    await broker.bus({ consumer, topics: { partitions: 2 } }).assertTopology();

    for (const topic of bus.describeTopology().topics) {
      expect(await broker.partitionsOf(topic.name)).toBe(2);
    }

    expect(bus.describeTopology().topics.map((topic) => topic.name)).toEqual([
      broker.topicOf('billing.invoice.issued'),
      broker.topicOf(PLACED),
      deadTopicOf(consumer, broker.topicOf(PLACED)),
    ]);
  });
});
