import { KafkaJS } from '@confluentinc/kafka-javascript';
import { ClientState, silentLogger } from './client-basics.js';
import type { ClusterState, TopicListener } from './cluster-state.js';
import { Unsupported, kafkaError } from './errors.js';
import { type Group, type GroupMember, positionKey } from './group.js';
import type { StoredRecord } from './log.js';
import type { Wire } from './wire.js';

type Pausable = { topic: string; partitions?: number[] };

/**
 * A member of a consumer group, read the way the KafkaJS layer of the client reads: `eachMessage`
 * one record at a time per partition, `partitionsConsumedConcurrently` partitions at once, the
 * same record again when `eachMessage` throws, nothing from a paused partition, and the
 * `rebalance_cb` of its configuration told of each assignment and revocation. A partition it is
 * given starts at the offset its group committed, or at the beginning or the end of the log.
 */
export class MemoryConsumer<K, V> implements KafkaJS.Consumer<K, V>, GroupMember, TopicListener {
  readonly id: number;

  readonly topics = new Set<string>();

  private readonly client: ClientState;

  private readonly group: Group;

  private readonly fromBeginning: boolean;

  private readonly rebalanced: unknown;

  private assigned: KafkaJS.TopicPartition[] = [];

  /** Bumped at each assignment: a record read before it does not move the new position. */
  private generation = 0;

  private readonly positions = new Map<string, bigint>();

  private readonly pausedKeys = new Set<string>();

  private readonly reading = new Set<string>();

  private readonly handling = new Set<Promise<void>>();

  private handler: ((payload: KafkaJS.EachMessagePayload<K, V>) => Promise<void>) | undefined;

  private concurrency = 1;

  private stopListening: () => void = () => undefined;

  constructor(
    private readonly cluster: ClusterState,
    private readonly wire: Wire,
    config: KafkaJS.ConsumerConstructorConfig<K, V>,
  ) {
    this.id = cluster.nextMemberId();
    this.client = new ClientState(wire);
    this.group = cluster.group(config.kafkaJS?.groupId ?? '');
    this.fromBeginning = config.kafkaJS?.fromBeginning === true;
    this.rebalanced = config.rebalance_cb;

    wire.onRestore(() => {
      this.read();
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
    this.stopListening = this.cluster.listen(this);
  }

  /** Reads nothing more, lets `eachMessage` finish, then leaves: its partitions go to the other members. */
  async disconnect(): Promise<void> {
    if (!this.client.isConnected) {
      return;
    }

    this.handler = undefined;

    while (this.handling.size > 0) {
      await Promise.allSettled([...this.handling]);
    }

    this.client.disconnect();
    this.stopListening();
    this.group.leave(this);
    this.revoke();
  }

  logger(): KafkaJS.Logger {
    return silentLogger();
  }

  /** Adds topics to the subscription; the group shares its partitions out again. */
  async subscribe(subscription: KafkaJS.ConsumerSubscribeTopics | KafkaJS.ConsumerSubscribeTopic): Promise<void> {
    this.client.ensureConnected('Subscribe');
    const topics = 'topics' in subscription ? subscription.topics : [subscription.topic];

    if (subscription.replace === true) {
      this.topics.clear();
    }

    for (const topic of topics) {
      this.topics.add(String(topic));
    }

    this.group.join(this);
  }

  async run(config: KafkaJS.ConsumerRunConfig<K, V> = {}): Promise<void> {
    this.client.ensureConnected('Run');
    this.handler = config.eachMessage;
    this.concurrency = Math.max(config.partitionsConsumedConcurrently ?? 1, 1);
    this.read();
  }

  async stop(): Promise<void> {
    throw new Unsupported('stop');
  }

  storeOffsets(): void {
    throw new Unsupported('storeOffsets');
  }

  async commitOffsets(offsets: KafkaJS.TopicPartitionOffsetAndMetadata[] = []): Promise<void> {
    this.client.ensureConnected('Commit');

    if (!this.wire.answering()) {
      throw kafkaError('ERR__TRANSPORT', 'Local: Broker transport failure');
    }

    for (const { topic, partition, offset } of offsets) {
      this.group.commit(topic, partition, BigInt(offset));
    }
  }

  async committed(): Promise<KafkaJS.TopicPartitionOffsetAndMetadata[]> {
    throw new Unsupported('committed');
  }

  seek({ topic, partition, offset }: KafkaJS.TopicPartitionOffset): void {
    this.positions.set(positionKey(topic, partition), BigInt(offset));
    this.read();
  }

  pause(topics: Pausable[]): void {
    this.client.ensureConnected('Pause');

    for (const key of this.keysOf(topics)) {
      this.pausedKeys.add(key);
    }
  }

  paused(): KafkaJS.TopicPartitions[] {
    throw new Unsupported('paused');
  }

  resume(topics: Pausable[]): void {
    this.client.ensureConnected('Resume');

    for (const key of this.keysOf(topics)) {
      this.pausedKeys.delete(key);
    }

    this.read();
  }

  assignment(): KafkaJS.TopicPartition[] {
    this.client.ensureConnected('Assignment');

    return [...this.assigned];
  }

  async clusterId(): Promise<string> {
    return 'in-memory';
  }

  setSaslCredentialProvider(): void {
    throw new Unsupported('setSaslCredentialProvider');
  }

  dependentAdmin(): KafkaJS.Admin {
    throw new Unsupported('dependentAdmin');
  }

  revoke(): void {
    if (this.assigned.length > 0) {
      this.tell(KafkaJS.ErrorCodes.ERR__REVOKE_PARTITIONS, this.assigned);
    }

    this.assigned = [];
    this.generation += 1;
    this.positions.clear();
    this.pausedKeys.clear();
  }

  assign(partitions: readonly KafkaJS.TopicPartition[]): void {
    if (!this.client.isConnected) {
      return;
    }

    this.assigned = [...partitions];
    this.generation += 1;

    for (const { topic, partition } of partitions) {
      const committed = this.group.committedOffset(topic, partition);
      const start = this.fromBeginning ? 0n : (this.cluster.topics.get(topic)?.endOf(partition) ?? 0n);

      this.positions.set(positionKey(topic, partition), committed ?? start);
    }

    this.tell(KafkaJS.ErrorCodes.ERR__ASSIGN_PARTITIONS, this.assigned);
    this.read();
  }

  grew(topic: string): void {
    if (this.topics.has(topic)) {
      this.read();
    }
  }

  /** Starts reading every partition that has a record waiting and room to take it. */
  private read(): void {
    for (const { topic, partition } of this.assigned) {
      const key = positionKey(topic, partition);
      const offset = this.positions.get(key) ?? 0n;
      const record = this.cluster.recordAt(topic, partition, offset);

      if (this.reading.size >= this.concurrency) {
        return;
      }

      if (this.canRead(key) && record !== undefined) {
        this.reading.add(key);
        const work = this.handle(topic, partition, record);

        this.handling.add(work);
        void work.finally(() => this.handling.delete(work));
      }
    }
  }

  private canRead(key: string): boolean {
    return (
      this.handler !== undefined &&
      this.client.isConnected &&
      this.wire.answering() &&
      !this.reading.has(key) &&
      !this.pausedKeys.has(key)
    );
  }

  /** One record through `eachMessage`, on the next turn; the position moves past it if it resolved. */
  private async handle(topic: string, partition: number, record: StoredRecord): Promise<void> {
    const key = positionKey(topic, partition);
    const generation = this.generation;
    const handler = this.handler;

    await new Promise((resolve) => setImmediate(resolve));

    // A record whose `eachMessage` threw is read again: its position does not move.
    const processed = await Promise.resolve(
      handler?.({
        topic,
        partition,
        message: this.messageOf(record),
        heartbeat: async () => undefined,
        pause: () => {
          this.pause([{ topic, partitions: [partition] }]);

          return () => {
            this.resume([{ topic, partitions: [partition] }]);
          };
        },
      }),
    ).then(
      () => true,
      () => false,
    );

    this.reading.delete(key);

    if (generation === this.generation && processed && this.positions.get(key) === record.offset) {
      this.positions.set(key, record.offset + 1n);
    }

    this.read();
  }

  private messageOf(record: StoredRecord): KafkaJS.KafkaMessage<K, V> {
    return {
      key: record.key,
      value: record.value,
      deserializedKey: { key: null, error: null },
      deserializedValue: { value: null, error: null },
      timestamp: record.timestamp,
      attributes: 0,
      offset: String(record.offset),
      headers: record.headers,
    };
  }

  private tell(code: number, partitions: readonly KafkaJS.TopicPartition[]): void {
    if (typeof this.rebalanced === 'function') {
      Reflect.apply(this.rebalanced, undefined, [{ code }, [...partitions]]);
    }
  }

  private keysOf(topics: readonly Pausable[]): string[] {
    return topics.flatMap(({ topic, partitions }) =>
      (partitions ?? this.assigned.filter((entry) => entry.topic === topic).map((entry) => entry.partition)).map(
        (partition) => positionKey(topic, partition),
      ),
    );
  }
}
