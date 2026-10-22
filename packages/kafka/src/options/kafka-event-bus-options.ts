import type { GlobalConfig, KafkaJS } from '@confluentinc/kafka-javascript';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import type { KafkaDelivery } from './kafka-delivery';
import type { KafkaFailure } from './kafka-failure';
import type { ReconnectOptions } from './reconnect-options';
import type { RetryOptions } from './retry-options';
import type { TopicOptions } from './topic-options';

export interface KafkaEventBusOptions {
  /** Bootstrap brokers as `host:port`, in a list or separated by commas. */
  readonly brokers: string | readonly string[];
  /** librdkafka properties given to every client of the bus: TLS, SASL, `client.id`. */
  readonly client?: GlobalConfig;
  /**
   * The KafkaJS client the bus builds its producer, consumers and admin from, instead of one
   * made of `brokers` and `client`, which it then does not read: a client the application
   * configures or instruments itself, or a cluster held in memory in tests. The bus
   * disconnects what it builds, never the client itself.
   */
  readonly cluster?: KafkaJS.Kafka;
  /** The consuming context `subscribe` works for: its name is the consumer group id. */
  readonly consumer?: string;
  /** The topic of an event type. Default: the type itself, one topic per event type. */
  readonly topicOf?: (type: string) => string;
  /**
   * The record key: events with the same key keep their order. Default: the event id, which
   * orders nothing. Give the aggregate id for per-aggregate order.
   */
  readonly keyOf?: (event: IntegrationEvent) => string | undefined;
  /** Event types this service publishes: `assertTopology` creates their topics at startup. */
  readonly publishedTypes?: readonly string[];
  readonly topics?: TopicOptions;
  /** Where a consumer group that has no committed offset starts. Default `earliest`. */
  readonly startFrom?: 'earliest' | 'latest';
  /** Partitions a consumer handles at once; records of one partition are never concurrent. Default 1. */
  readonly concurrency?: number;
  /** Time the in-sync replicas have to acknowledge a record before `publish` rejects. Default 30000. */
  readonly publishTimeoutMs?: number;
  /** Time a connection or an administrative request may take. Default 10000. */
  readonly connectTimeoutMs?: number;
  /** `max.poll.interval.ms`: above it, the handlers of one record lose their partitions. Default 300000. */
  readonly maxHandlingMs?: number;
  readonly retry?: RetryOptions;
  readonly reconnect?: ReconnectOptions;
  /** Observability hook. It receives codes only, so it is safe to log as is. */
  readonly onFailure?: (failure: KafkaFailure) => void;
  /** Metrics hook, called once per record a consumer settles, before its offset is committed. */
  readonly onDelivery?: (delivery: KafkaDelivery) => void;
}
