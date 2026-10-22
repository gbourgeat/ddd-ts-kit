import type { ExecutionScope } from '@ddd-ts-kit/kernel';
import type { RedisSource } from '../../connection/redis-source';
import type { DeduplicationOptions } from './deduplication-options';
import type { ReconnectOptions } from './reconnect-options';
import type { RedisStreamsDelivery } from './redis-streams-delivery';
import type { RedisStreamsFailure } from './redis-streams-failure';
import type { RetentionOptions } from './retention-options';
import type { RetryOptions } from './retry-options';

export interface RedisStreamsEventBusOptions {
  /**
   * A connection URL, ioredis options, or a client the application already owns. The bus
   * publishes and acknowledges on it, and duplicates it for each blocking reader. It closes
   * what it opened; a client it was handed stays open.
   */
  readonly connection: RedisSource;

  /** Events of a type go to the stream `<prefix>:<type>`. Default `integration-events`. */
  readonly prefix?: string;

  /** The stream of an event type, when `<prefix>:<type>` does not suit. Publishers and consumers must agree. */
  readonly streamOf?: (type: string) => string;

  /** The consuming context `subscribe` reads for: the name of its consumer group. See also `forConsumer`. */
  readonly consumer?: string;

  /** The name of this process inside its groups. Default: host, process id and a random suffix. */
  readonly instance?: string;

  /** Entries read at once per stream, then handled one after the other. Default 10. */
  readonly batchSize?: number;

  /** How long a read waits for new entries. It bounds `close()` and the precision of the retry delay. Default 1000. */
  readonly blockMs?: number;

  /**
   * Idle time after which the pending entries of ANOTHER instance are taken over: it crashed,
   * or it is stuck. Keep it above the worst case of a whole batch. Default 60000.
   */
  readonly visibilityTimeoutMs?: number;

  /** Where a group created by this bus starts: entries published from now on (default), or the whole stream. */
  readonly startFrom?: 'new' | 'beginning';

  readonly retry?: RetryOptions;

  readonly reconnect?: ReconnectOptions;

  /** Default: none, streams grow until trimmed by the operator. */
  readonly retention?: RetentionOptions;

  /** A publish-side guard against the duplicates of a relay retry. Default: none, consumers deduplicate. */
  readonly deduplication?: DeduplicationOptions;

  /** When given, every handler runs inside it, in the execution context of its event. */
  readonly scope?: ExecutionScope;

  /** Observability hook. It receives codes only, so it is safe to log as is. */
  readonly onFailure?: (failure: RedisStreamsFailure) => void;

  /** Metrics hook, called once per entry a consumer settles, before it is acknowledged. */
  readonly onDelivery?: (delivery: RedisStreamsDelivery) => void;
}
