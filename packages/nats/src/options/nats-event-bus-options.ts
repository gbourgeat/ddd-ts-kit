import type { NatsConnection, NodeConnectionOptions } from '@nats-io/transport-node';
import type { NatsDelivery } from './nats-delivery';
import type { NatsFailure } from './nats-failure';
import type { ReconnectOptions } from './reconnect-options';
import type { RetryOptions } from './retry-options';
import type { StreamStorage } from './stream-storage';

export const DEFAULT_STREAM = 'integration-events';
export const DEFAULT_SUBJECT_PREFIX = 'events';

export interface NatsEventBusOptions {
  /**
   * Server URLs, connection options of the client, or a factory opening a NEW connection each
   * time it is called (credentials, TLS). The bus owns what it opens and closes it.
   */
  readonly connection: string | readonly string[] | NodeConnectionOptions | (() => Promise<NatsConnection>);
  /** The stream that keeps the events. Default `integration-events`. */
  readonly stream?: string;
  /** Events are published to `<subjectPrefix>.<event type>`. Default `events`. */
  readonly subjectPrefix?: string;
  /** The consuming context `subscribe` creates its durable consumers for. See also `forConsumer`. */
  readonly consumer?: string;
  /** Messages of one durable consumer this bus handles at once. Default 10. */
  readonly prefetch?: number;
  /** Default `file`. */
  readonly storage?: StreamStorage;
  /** Replicas of the streams the bus creates. Default 1; use 3 on a cluster. */
  readonly replicas?: number;
  /** Time during which the stream drops a second message with the same event id. Default 120000. */
  readonly duplicateWindowMs?: number;
  /** Time a handler has before the server delivers its message to someone else. Default 30000. */
  readonly ackWaitMs?: number;
  /** Time the stream has to acknowledge a publication before `publish` rejects. Default 5000. */
  readonly publishTimeoutMs?: number;
  readonly retry?: RetryOptions;
  readonly reconnect?: ReconnectOptions;
  /** Observability hook. It receives codes only, so it is safe to log as is. */
  readonly onFailure?: (failure: NatsFailure) => void;
  /** Metrics hook, called once per message a consumer settles, before it is acknowledged. */
  readonly onDelivery?: (delivery: NatsDelivery) => void;
}
