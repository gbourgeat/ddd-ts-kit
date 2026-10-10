import type { GlobalConfig } from '@confluentinc/kafka-javascript';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import type { KafkaDelivery } from './kafka-delivery.js';
import type { KafkaFailure } from './kafka-failure.js';
import type { ReconnectOptions } from './reconnect-options.js';
import type { RetryOptions } from './retry-options.js';
import type { TopicOptions } from './topic-options.js';

/** The options of a bus with every default applied. */
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
