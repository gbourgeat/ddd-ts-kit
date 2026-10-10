import type { GlobalConfig } from '@confluentinc/kafka-javascript';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';

export interface RetryOptions {
  /** Deliveries after which a record goes to the dead-letter topic. Default 5. */
  readonly maxAttempts?: number;
  /** Time the partition of a failed record stays paused before it is read again. Default 5000. */
  readonly delayMs?: number;
}

export interface ReconnectOptions {
  /** Delay before a consumer that could not start, commit or dead-letter tries again. Default 200. */
  readonly initialMs?: number;
  /** Multiplier applied at each further attempt. Default 2. */
  readonly factor?: number;
  /** Upper bound of the delay. Default 30000. */
  readonly maxMs?: number;
}

export interface TopicOptions {
  /** Partitions of a topic the bus creates. Default -1: `num.partitions` of the broker. */
  readonly partitions?: number;
  /** Default -1: `default.replication.factor` of the broker. Use 3 in production. */
  readonly replicationFactor?: number;
  /** Default true. With false the bus creates nothing and expects every topic to exist. */
  readonly create?: boolean;
}

export type KafkaFailure =
  | {
      readonly kind: 'handler';
      readonly consumer: string;
      readonly topic: string;
      readonly eventId: string;
      readonly eventType: string;
      readonly code: string;
      readonly attempt: number;
      readonly dead: boolean;
    }
  | { readonly kind: 'poison'; readonly consumer: string; readonly topic: string; readonly code: string }
  | { readonly kind: 'connection'; readonly code: string };

/** One record settled by a consumer of this bus. Counted by outcome, it is the metric to watch. */
export interface KafkaDelivery {
  readonly consumer: string;
  readonly topic: string;
  readonly partition: number;
  /** Which delivery of the record this was, starting at 1. */
  readonly attempt: number;
  /**
   * `acknowledged`: every handler resolved, the offset is committed next. `retried`: the
   * partition is paused for the delay, then the record is read again. `dead`: attempts spent,
   * copied to the dead-letter topic. `poison`: not an envelope, copied there too.
   */
  readonly outcome: 'acknowledged' | 'retried' | 'dead' | 'poison';
}

export interface KafkaEventBusOptions {
  /** Bootstrap brokers as `host:port`, in a list or separated by commas. */
  readonly brokers: string | readonly string[];
  /** librdkafka properties given to every client of the bus: TLS, SASL, `client.id`. */
  readonly client?: GlobalConfig;
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

export interface Settings {
  readonly brokers: string[];
  readonly client: GlobalConfig;
  readonly consumer: string | undefined;
  readonly topicOf: (type: string) => string;
  readonly keyOf: (event: IntegrationEvent) => string | undefined;
  readonly publishedTypes: readonly string[];
  readonly topics: Required<TopicOptions>;
  readonly startFromEarliest: boolean;
  readonly concurrency: number;
  readonly publishTimeoutMs: number;
  readonly connectTimeoutMs: number;
  readonly maxHandlingMs: number;
  readonly retry: Required<RetryOptions>;
  readonly reconnect: Required<ReconnectOptions>;
  readonly onFailure: (failure: KafkaFailure) => void;
  readonly onDelivery: (delivery: KafkaDelivery) => void;
}

export function settingsOf(options: KafkaEventBusOptions): Settings {
  return {
    brokers: brokersOf(options.brokers),
    client: options.client ?? {},
    consumer: options.consumer,
    topicOf: options.topicOf ?? ((type) => type),
    keyOf: options.keyOf ?? ((event) => event.id),
    publishedTypes: options.publishedTypes ?? [],
    topics: topicsOf(options.topics),
    startFromEarliest: options.startFrom !== 'latest',
    concurrency: options.concurrency ?? 1,
    publishTimeoutMs: options.publishTimeoutMs ?? 30_000,
    connectTimeoutMs: options.connectTimeoutMs ?? 10_000,
    maxHandlingMs: options.maxHandlingMs ?? 300_000,
    retry: retryOf(options.retry),
    reconnect: reconnectOf(options.reconnect),
    onFailure: guarded(options.onFailure),
    onDelivery: guarded(options.onDelivery),
  };
}

/** The delay before the attempt that follows `failures` failed ones. */
export function backoffOf(reconnect: Required<ReconnectOptions>, failures: number): number {
  return Math.min(reconnect.maxMs, reconnect.initialMs * reconnect.factor ** failures);
}

function brokersOf(brokers: string | readonly string[]): string[] {
  const listed = typeof brokers === 'string' ? brokers.split(',') : [...brokers];
  return listed.map((broker) => broker.trim()).filter((broker) => broker.length > 0);
}

function topicsOf(topics: TopicOptions = {}): Required<TopicOptions> {
  return {
    partitions: topics.partitions ?? -1,
    replicationFactor: topics.replicationFactor ?? -1,
    create: topics.create ?? true,
  };
}

function retryOf(retry: RetryOptions = {}): Required<RetryOptions> {
  return { maxAttempts: retry.maxAttempts ?? 5, delayMs: retry.delayMs ?? 5_000 };
}

function reconnectOf(reconnect: ReconnectOptions = {}): Required<ReconnectOptions> {
  return {
    initialMs: reconnect.initialMs ?? 200,
    factor: reconnect.factor ?? 2,
    maxMs: reconnect.maxMs ?? 30_000,
  };
}

// A hook that throws must not leave a record uncommitted or stop a consumer.
function guarded<T>(hook: ((value: T) => void) | undefined): (value: T) => void {
  return (value) => {
    try {
      hook?.(value);
    } catch {
      return;
    }
  };
}
