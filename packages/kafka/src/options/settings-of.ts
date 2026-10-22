import type { KafkaEventBusOptions } from './kafka-event-bus-options';
import type { ReconnectOptions } from './reconnect-options';
import type { RetryOptions } from './retry-options';
import type { Settings } from './settings';
import type { TopicOptions } from './topic-options';

export function settingsOf(options: KafkaEventBusOptions): Settings {
  return {
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
