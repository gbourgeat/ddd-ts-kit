import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import type { KafkaDelivery } from './kafka-delivery';
import type { KafkaFailure } from './kafka-failure';
import type { ReconnectOptions } from './reconnect-options';
import type { RetryOptions } from './retry-options';
import type { TopicOptions } from './topic-options';

/**
 * The options of a bus with every default applied. The brokers and the client properties are
 * not among them: they carry credentials, and nothing that outlives the constructor keeps them.
 */
export interface Settings {
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
