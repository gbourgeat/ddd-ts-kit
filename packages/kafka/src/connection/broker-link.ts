import { inspect } from 'node:util';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import { BrokerUnavailableError } from '../errors/broker-unavailable-error';
import { EventBusClosedError } from '../errors/event-bus-closed-error';
import { failureCode } from '../errors/failure-code';
import { within } from '../errors/within';
import { ignore } from '../ignore';
import { conceal } from '../secrecy/conceal';
import type { TopicDescription } from '../topology/topic-description';
import type { Rebalance } from './rebalance';

export interface LinkSettings {
  readonly createTopics: boolean;
  readonly startFromEarliest: boolean;
  readonly publishTimeoutMs: number;
  readonly connectTimeoutMs: number;
  readonly maxHandlingMs: number;
}

interface Connectable {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

const UNKNOWN_TOPIC = 'ERR_UNKNOWN_TOPIC_OR_PART';
const ASSIGNED = KafkaJS.ErrorCodes.ERR__ASSIGN_PARTITIONS;
const DESCRIPTION = 'BrokerLink [clients concealed]';

/**
 * The cluster as the bus sees it: it builds the clients with the settings every one of them
 * shares, and creates topics. Each client keeps its own connections alive: librdkafka
 * reconnects by itself, so there is no connection for the bus to watch.
 */
export class BrokerLink {
  private readonly kafka: KafkaJS.Kafka;

  private readonly settings: LinkSettings;

  private readonly known = new Set<string>();

  private adminClient: Promise<KafkaJS.Admin> | undefined;

  private closed = false;

  constructor(kafka: KafkaJS.Kafka, settings: LinkSettings) {
    this.kafka = kafka;
    this.settings = settings;
    conceal(this);
  }

  /** Idempotent and acknowledged by every in-sync replica: what an outbox relay needs. */
  producer(): KafkaJS.Producer {
    return this.kafka.producer({
      kafkaJS: { idempotent: true, acks: -1, allowAutoTopicCreation: false },
      // `publish` awaits every acknowledgement: lingering would only delay it.
      'linger.ms': 0,
      'message.timeout.ms': this.settings.publishTimeoutMs,
    });
  }

  /** A member of `groupId` that commits nothing by itself. */
  consumer(groupId: string, rebalanced: (rebalance: Rebalance) => void): KafkaJS.Consumer {
    return this.kafka.consumer({
      kafkaJS: {
        groupId,
        fromBeginning: this.settings.startFromEarliest,
        autoCommit: false,
        allowAutoTopicCreation: false,
      },
      'max.poll.interval.ms': this.settings.maxHandlingMs,
      rebalance_cb: (error: unknown, partitions: KafkaJS.TopicPartition[]) => {
        rebalanced({ assigned: numericCodeOf(error) === ASSIGNED, partitions });
      },
    });
  }

  /** Connects a client, or disconnects it and fails with a code when the cluster is silent. */
  async connected<Client extends Connectable>(client: Client): Promise<Client> {
    if (this.closed) {
      throw new EventBusClosedError();
    }

    try {
      await within(client.connect(), this.settings.connectTimeoutMs, 'CONNECT_TIMEOUT');
    } catch (error) {
      void client.disconnect().catch(ignore);
      throw unavailable(error);
    }

    return client;
  }

  /**
   * Asks the cluster for its topics, whatever there is to declare: a cluster out of reach fails
   * with `BROKER_UNAVAILABLE`, at startup rather than at the first record.
   */
  async reach(): Promise<void> {
    const admin = await this.admin();

    await this.answered(admin.listTopics());
  }

  /** Creates the topics that do not exist yet. An existing topic is never altered. */
  async declare(topics: readonly TopicDescription[]): Promise<void> {
    const missing = topics.filter((topic) => !this.known.has(topic.name));

    if (missing.length === 0 || !this.settings.createTopics) {
      return;
    }

    const admin = await this.admin();
    const timeout = this.settings.connectTimeoutMs;

    await this.answered(admin.createTopics({ topics: missing.map(configOf), timeout }));

    await this.answered(
      visible(
        admin,
        missing.map((topic) => topic.name),
      ),
    );

    for (const topic of missing) {
      this.known.add(topic.name);
    }
  }

  async admin(): Promise<KafkaJS.Admin> {
    this.adminClient ??= this.connected(this.kafka.admin());

    try {
      return await this.adminClient;
    } catch (error) {
      this.adminClient = undefined;
      throw error;
    }
  }

  /** The answer of an administrative request, or `BROKER_UNAVAILABLE` with the code of its failure. */
  async answered<T>(request: Promise<T>): Promise<T> {
    try {
      return await within(request, this.settings.connectTimeoutMs, 'REQUEST_TIMEOUT');
    } catch (error) {
      throw unavailable(error);
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    const admin = await this.adminClient?.catch(ignore);

    this.adminClient = undefined;
    await admin?.disconnect().catch(ignore);
  }

  toJSON(): string {
    return DESCRIPTION;
  }

  [inspect.custom](): string {
    return DESCRIPTION;
  }
}

function numericCodeOf(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
}

// Rethrown without its message or cause: an error of the client may quote the brokers.
function unavailable(error: unknown): Error {
  if (error instanceof BrokerUnavailableError || error instanceof EventBusClosedError) {
    return error;
  }

  return new BrokerUnavailableError(failureCode(error));
}

function configOf(topic: TopicDescription): KafkaJS.ITopicConfig {
  return {
    topic: topic.name,
    ...(topic.partitions > 0 ? { numPartitions: topic.partitions } : {}),
    ...(topic.replicationFactor > 0 ? { replicationFactor: topic.replicationFactor } : {}),
  };
}

// A topic is created asynchronously: a client that subscribes before the broker lists it
// waits for its next metadata refresh, minutes later.
async function visible(admin: KafkaJS.Admin, topics: string[]): Promise<void> {
  for (;;) {
    try {
      await admin.fetchTopicMetadata({ topics });

      return;
    } catch (error) {
      if (failureCode(error) !== UNKNOWN_TOPIC) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}
