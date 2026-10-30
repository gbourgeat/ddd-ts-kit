import type { KafkaJS } from '@confluentinc/kafka-javascript';
import { ClientState, silentLogger } from './client-basics';
import type { ClusterState } from './cluster-state';
import { Unsupported, kafkaError } from './errors';
import type { Wire } from './wire';

const DEFAULT_MESSAGE_TIMEOUT_MS = 300_000;

interface PendingSend {
  readonly topic: string;
  readonly messages: readonly KafkaJS.Message<unknown, unknown>[];
  written: KafkaJS.RecordMetadata[] | undefined;
  readonly timer: ReturnType<typeof setTimeout>;
  readonly resolve: (metadata: KafkaJS.RecordMetadata[]) => void;
}

/**
 * A producer with `acks=all`: a send resolves once the cluster wrote its records and answered.
 * Until then it waits for the network, as librdkafka retries, and fails with
 * `ERR__MSG_TIMED_OUT` after `message.timeout.ms`. A record written once is not written again.
 */
export class MemoryProducer<K, V> implements KafkaJS.Producer<K, V> {
  private readonly client: ClientState;

  private readonly pending = new Set<PendingSend>();

  private readonly timeoutMs: number;

  /** The fatal error the producer met: it refuses every send from then on, as librdkafka does. */
  private fatal: KafkaJS.KafkaJSError | undefined;

  constructor(
    private readonly cluster: ClusterState,
    private readonly wire: Wire,
    config: KafkaJS.ProducerConstructorConfig<K, V> | undefined,
  ) {
    this.client = new ClientState(wire);
    this.timeoutMs = config?.['message.timeout.ms'] ?? DEFAULT_MESSAGE_TIMEOUT_MS;

    wire.onRestore(() => {
      this.attempt();
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    this.client.disconnect();
  }

  logger(): KafkaJS.Logger {
    return silentLogger();
  }

  async send(record: KafkaJS.ProducerRecord<K, V>): Promise<KafkaJS.RecordMetadata[]> {
    this.client.ensureConnected('send');

    if (this.fatal === undefined && this.wire.producerStateLost()) {
      this.fatal = kafkaError('ERR_UNKNOWN_PRODUCER_ID', 'Broker: Unknown Producer Id', { fatal: true });
    }

    if (this.fatal !== undefined) {
      throw this.fatal;
    }

    if (!this.cluster.topics.has(record.topic)) {
      throw kafkaError('ERR_UNKNOWN_TOPIC_OR_PART', 'Broker: Unknown topic or partition');
    }

    this.wire.sent();

    return new Promise((resolve, reject) => {
      const send: PendingSend = {
        topic: record.topic,
        messages: record.messages,
        written: undefined,
        timer: setTimeout(() => {
          this.pending.delete(send);
          reject(kafkaError('ERR__MSG_TIMED_OUT', 'Local: Message timed out'));
        }, this.timeoutMs),
        resolve,
      };

      this.pending.add(send);
      this.attempt();
    });
  }

  async sendBatch(): Promise<KafkaJS.RecordMetadata[]> {
    throw new Unsupported('sendBatch');
  }

  async flush(): Promise<void> {
    return undefined;
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

  async transaction(): Promise<KafkaJS.Transaction> {
    throw new Unsupported('transaction');
  }

  async commit(): Promise<void> {
    throw new Unsupported('commit');
  }

  async abort(): Promise<void> {
    throw new Unsupported('abort');
  }

  async sendOffsets(): Promise<void> {
    throw new Unsupported('sendOffsets');
  }

  isActive(): boolean {
    return false;
  }

  /** Writes what reaches the cluster, and settles what the cluster answers. */
  private attempt(): void {
    for (const send of [...this.pending]) {
      if (send.written === undefined && this.wire.reaching() && this.cluster.topics.has(send.topic)) {
        const now = Date.now();

        send.written = send.messages.map((message) => this.cluster.append(send.topic, message, now));
      }

      if (send.written !== undefined && this.wire.answering()) {
        clearTimeout(send.timer);
        this.pending.delete(send);
        send.resolve(send.written);
      }
    }
  }
}
