import type { ExecutionScope } from '@ddd-ts-kit/kernel';
import type { DeduplicationOptions } from './deduplication-options.js';
import type { ReconnectOptions } from './reconnect-options.js';
import type { RedisStreamsDelivery } from './redis-streams-delivery.js';
import type { RedisStreamsFailure } from './redis-streams-failure.js';
import type { RetentionOptions } from './retention-options.js';
import type { RetryOptions } from './retry-options.js';

/**
 * The options of a bus with their defaults applied. The connection is not among them: a URL
 * may carry a password, and nothing that outlives the constructor keeps it.
 */
export interface Settings {
  readonly streamOf: (type: string) => string;
  readonly consumer: string | undefined;
  readonly instance: string;
  readonly batchSize: number;
  readonly blockMs: number;
  readonly visibilityTimeoutMs: number;
  readonly startFrom: 'new' | 'beginning';
  readonly retry: Required<RetryOptions>;
  readonly reconnect: Required<ReconnectOptions>;
  readonly retention: RetentionOptions | undefined;
  readonly deduplication: DeduplicationOptions | undefined;
  readonly scope: ExecutionScope | undefined;
  readonly onFailure: (failure: RedisStreamsFailure) => void;
  readonly onDelivery: (delivery: RedisStreamsDelivery) => void;
}
