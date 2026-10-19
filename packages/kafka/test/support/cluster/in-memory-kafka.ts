import type { KafkaJS } from '@confluentinc/kafka-javascript';
import { ClusterState } from './cluster-state.js';
import { MemoryAdmin } from './memory-admin.js';
import { MemoryConsumer } from './memory-consumer.js';
import { MemoryProducer } from './memory-producer.js';
import { RELIABLE, type Wire } from './wire.js';

/**
 * A Kafka cluster in the memory of the test, behind the KafkaJS interfaces of
 * `@confluentinc/kafka-javascript`, handed to the bus through its `cluster` option so that its
 * suites run in the unit run too. One instance is one cluster; `through` gives another view of
 * it whose clients go through a network the test sabotages. It keeps what the bus relies on:
 * topics and their partitions, a key always on one partition, consumer groups sharing their
 * partitions out at each join and leave, committed offsets, `eachMessage` read again after it
 * threw, paused partitions, acknowledgements that time out. Not kept: replication,
 * transactions, compaction, retention, `eachBatch`, the cooperative assignor.
 */
export class InMemoryKafka implements KafkaJS.Kafka {
  constructor(
    private readonly state: ClusterState = new ClusterState(),
    private readonly wire: Wire = RELIABLE,
  ) {}

  /** The same cluster, for clients that go through `wire`. */
  through(wire: Wire): InMemoryKafka {
    return new InMemoryKafka(this.state, wire);
  }

  producer<K = Buffer | string, V = Buffer | string>(
    config?: KafkaJS.ProducerConstructorConfig<K, V>,
  ): KafkaJS.Producer<K, V> {
    return new MemoryProducer<K, V>(this.state, this.wire, config);
  }

  consumer<K = Buffer, V = Buffer>(config: KafkaJS.ConsumerConstructorConfig<K, V>): KafkaJS.Consumer<K, V> {
    return new MemoryConsumer<K, V>(this.state, this.wire, config);
  }

  admin(): KafkaJS.Admin {
    return new MemoryAdmin(this.state, this.wire);
  }
}
