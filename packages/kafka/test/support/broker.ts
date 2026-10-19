import { KafkaJS } from '@confluentinc/kafka-javascript';
import { KafkaEventBus, type KafkaEventBusOptions } from '../../src/index.js';
import { InMemoryKafka } from './cluster/in-memory-kafka.js';
import { KAFKA_RELAY, MAX_ATTEMPTS, RETRY_DELAY_MS } from './environment.js';
import { FaultyNetwork } from './faulty-network.js';
import { MemoryNetwork } from './memory-network.js';
import type { Network, NetworkConnection } from './network.js';
import type { StoredRecord } from './stored-record.js';
import { unique } from './unique.js';
import { eventually } from './waiting.js';

interface Reach {
  /** What a bus connects with: the bootstrap brokers, or the in-memory cluster. */
  readonly connection: NetworkConnection;
  /** A network the test can sabotage, when this broker has one. */
  readonly network: (() => Promise<Network>) | undefined;
  /** What a bus connects with to reach nothing. */
  readonly unreachable: () => NetworkConnection;
}

/**
 * A second, plain Kafka client next to the buses under test: it reads the topics, drops raw
 * records in, measures the lag of the groups, and deletes what the test created. Every topic
 * and group of a test starts with the namespace of its `Broker`. On a real cluster or on the
 * in-memory one, the same specs hold.
 */
export class Broker {
  readonly namespace = unique('t');

  private readonly buses: KafkaEventBus[] = [];

  private constructor(
    private readonly reach: Reach,
    private readonly kafka: KafkaJS.Kafka,
    private readonly admin: KafkaJS.Admin,
    private readonly producer: KafkaJS.Producer,
  ) {}

  static async connect(brokers: string): Promise<Broker> {
    const relay = KAFKA_RELAY;

    const kafka = new KafkaJS.Kafka({
      kafkaJS: { brokers: brokers.split(','), logLevel: KafkaJS.logLevel.NOTHING },
    });

    return Broker.on(kafka, {
      connection: { brokers },
      network: relay === undefined ? undefined : () => FaultyNetwork.from(relay),
      unreachable: () => ({ brokers: '127.0.0.1:1' }),
    });
  }

  static async inMemory(): Promise<Broker> {
    const cluster = new InMemoryKafka();

    return Broker.on(cluster, {
      connection: { cluster },
      network: async () => new MemoryNetwork(cluster),
      unreachable: () => {
        const network = new MemoryNetwork(cluster);

        void network.close();

        return network.connection;
      },
    });
  }

  private static async on(kafka: KafkaJS.Kafka, reach: Reach): Promise<Broker> {
    const admin = kafka.admin();
    const producer = kafka.producer({ kafkaJS: { allowAutoTopicCreation: false }, 'linger.ms': 0 });

    await Promise.all([admin.connect(), producer.connect()]);

    return new Broker(reach, kafka, admin, producer);
  }

  /** A network between a bus and this broker that the test can sabotage. */
  network(): Promise<Network> {
    if (this.reach.network === undefined) {
      throw new Error('This broker has no network to sabotage: set DDD_TS_KIT_TEST_KAFKA_RELAY.');
    }

    return this.reach.network();
  }

  unreachable(): NetworkConnection {
    return this.reach.unreachable();
  }

  readonly topicOf = (type: string): string => `${this.namespace}.${type}`;

  /** A consumer name of this test: its group and its dead-letter topics are cleaned up. */
  consumer(name: string): string {
    return `${this.namespace}.${unique(name)}`;
  }

  /** A bus on topics of this test, with fast retries. Closed and cleaned by `dispose`. */
  bus(options: Partial<KafkaEventBusOptions> = {}): KafkaEventBus {
    const bus = new KafkaEventBus({
      brokers: 'in-memory',
      ...this.reach.connection,
      consumer: this.consumer('consumer'),
      topicOf: this.topicOf,
      retry: { delayMs: RETRY_DELAY_MS, maxAttempts: MAX_ATTEMPTS },
      reconnect: { initialMs: 20, maxMs: 200 },
      ...options,
    });

    this.buses.push(bus);

    return bus;
  }

  async send(topic: string, value: string): Promise<void> {
    await this.producer.send({ topic, messages: [{ key: null, value }] });
  }

  /** How many records the topic holds; 0 for a topic that does not exist. */
  async countIn(topic: string): Promise<number> {
    const ends = await this.admin.fetchTopicOffsets(topic).catch(() => []);

    return ends.reduce((total, { high, low }) => total + Number(high) - Number(low), 0);
  }

  async partitionsOf(topic: string): Promise<number> {
    const [metadata] = await this.admin.fetchTopicMetadata({ topics: [topic] });

    return metadata?.partitions.length ?? 0;
  }

  /** Every record of the topic, read from its beginning by a throwaway group. */
  async recordsOf(topic: string): Promise<StoredRecord[]> {
    const expected = await this.countIn(topic);
    const records: StoredRecord[] = [];

    const reader = this.kafka.consumer({
      kafkaJS: { groupId: `${this.namespace}.${unique('reader')}`, fromBeginning: true, autoCommit: false },
    });

    await reader.connect();
    await reader.subscribe({ topics: [topic] });
    await reader.run({ eachMessage: async ({ message }) => void records.push(storedRecord(message)) });
    await eventually(() => records.length >= expected);
    await reader.disconnect();

    return records;
  }

  /** Records a group has not committed yet, over the topics it consumes. */
  async lagOf(groupId: string, topics: readonly string[]): Promise<number> {
    const committed = await this.admin.fetchOffsets({ groupId, topics: [...topics] });
    let lag = 0;

    for (const topic of topics) {
      const positions = committed.find((entry) => entry.topic === topic)?.partitions ?? [];

      for (const { partition, high, low } of await this.admin.fetchTopicOffsets(topic)) {
        const position = Number(positions.find((entry) => entry.partition === partition)?.offset ?? -1);

        lag += Number(high) - Math.max(position, Number(low));
      }
    }

    return lag;
  }

  /**
   * Resolves once everything published to the bus was delivered or given up on: no lag on
   * any of its groups (a record waiting for a retry is not committed, so it counts) and no
   * handler running, three checks in a row.
   */
  async settled(bus: KafkaEventBus): Promise<void> {
    await bus.assertTopology();
    let quietChecks = 0;

    await eventually(async () => {
      quietChecks = (await this.isQuiet(bus)) ? quietChecks + 1 : 0;

      return quietChecks >= 3;
    }, 30_000);
  }

  async dispose(): Promise<void> {
    await Promise.all(this.buses.map((bus) => bus.close()));
    await this.producer.disconnect();
    const mine = (name: string): boolean => name.startsWith(this.namespace);
    const topics = (await this.admin.listTopics()).filter(mine);
    const { groups } = await this.admin.listGroups();
    const groupIds = groups.map((group) => group.groupId).filter(mine);

    if (groupIds.length > 0) {
      await this.admin.deleteGroups(groupIds).catch(() => undefined);
    }

    if (topics.length > 0) {
      await this.admin.deleteTopics({ topics });
    }

    await this.admin.disconnect();
  }

  private async isQuiet(bus: KafkaEventBus): Promise<boolean> {
    for (const { groupId, topics } of bus.describeTopology().groups) {
      if ((await this.lagOf(groupId, topics)) > 0) {
        return false;
      }
    }

    return bus.deliveriesInFlight === 0;
  }
}

function storedRecord(message: KafkaJS.KafkaMessage): StoredRecord {
  const headers = Object.entries(message.headers ?? {}).map(([name, value]) => [name, String(value)]);

  return {
    key: message.key?.toString(),
    value: message.value?.toString() ?? '',
    headers: Object.fromEntries(headers),
  };
}
