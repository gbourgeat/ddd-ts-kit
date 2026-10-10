import type { NatsConnection, NodeConnectionOptions } from '@nats-io/transport-node';

export interface RetryOptions {
  /** Deliveries after which a message goes to the dead-letter stream. Default 5. */
  readonly maxAttempts?: number;
  /** Time the server waits before it delivers a failed message again. Default 5000. */
  readonly delayMs?: number;
}

export interface ReconnectOptions {
  /** Delay before the first reconnection attempt. Default 200. */
  readonly initialMs?: number;
  /** Multiplier applied at each further attempt to open a first connection. Default 2. */
  readonly factor?: number;
  /** Upper bound of the delay. Default 30000. */
  readonly maxMs?: number;
}

export type StreamStorage = 'file' | 'memory';

export type NatsFailure =
  | {
      readonly kind: 'handler';
      readonly consumer: string;
      readonly eventId: string;
      readonly eventType: string;
      readonly code: string;
      readonly attempt: number;
      readonly dead: boolean;
    }
  | { readonly kind: 'poison'; readonly consumer: string; readonly code: string }
  | { readonly kind: 'connection'; readonly code: string };

/** One message settled by a consumer of this bus. Counted by outcome, it is the metric to watch. */
export interface NatsDelivery {
  /** The durable consumer the message was delivered to. */
  readonly consumer: string;
  /** Which delivery of the message this was, starting at 1: the delivery count of the server. */
  readonly attempt: number;
  /**
   * `acknowledged`: every handler resolved. `retried`: refused with a delay, the server
   * delivers it again. `dead`: attempts spent, copied to the dead-letter stream and
   * terminated. `poison`: not an envelope, copied there too.
   */
  readonly outcome: 'acknowledged' | 'retried' | 'dead' | 'poison';
}

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

export interface Settings {
  readonly open: () => Promise<NatsConnection>;
  readonly stream: string;
  readonly subjectPrefix: string;
  readonly consumer: string | undefined;
  readonly prefetch: number;
  readonly storage: StreamStorage;
  readonly replicas: number;
  readonly duplicateWindowMs: number;
  readonly ackWaitMs: number;
  readonly publishTimeoutMs: number;
  readonly retry: Required<RetryOptions>;
  readonly reconnect: Required<ReconnectOptions>;
  readonly onFailure: (failure: NatsFailure) => void;
  readonly onDelivery: (delivery: NatsDelivery) => void;
}

export const DEFAULT_STREAM = 'integration-events';
export const DEFAULT_SUBJECT_PREFIX = 'events';

export function settingsOf(
  options: NatsEventBusOptions,
  connect: (target: NodeConnectionOptions) => Promise<NatsConnection>,
): Settings {
  const reconnect = reconnectOf(options.reconnect);
  const { connection } = options;
  return {
    open: typeof connection === 'function' ? connection : () => connect(targetOf(connection, reconnect)),
    stream: options.stream ?? DEFAULT_STREAM,
    subjectPrefix: options.subjectPrefix ?? DEFAULT_SUBJECT_PREFIX,
    consumer: options.consumer,
    prefetch: options.prefetch ?? 10,
    storage: options.storage ?? 'file',
    replicas: options.replicas ?? 1,
    duplicateWindowMs: options.duplicateWindowMs ?? 120_000,
    ackWaitMs: options.ackWaitMs ?? 30_000,
    publishTimeoutMs: options.publishTimeoutMs ?? 5_000,
    retry: retryOf(options.retry),
    reconnect,
    onFailure: guarded(options.onFailure),
    onDelivery: guarded(options.onDelivery),
  };
}

// The client reconnects by itself, for ever unless told otherwise: the bus only has to open
// the first connection, and another one if the client gives up.
function targetOf(
  connection: string | readonly string[] | NodeConnectionOptions,
  reconnect: Required<ReconnectOptions>,
): NodeConnectionOptions {
  const given = typeof connection === 'string' || isList(connection) ? { servers: [...asList(connection)] } : connection;
  return { maxReconnectAttempts: -1, reconnectTimeWait: reconnect.initialMs, ...given };
}

function isList(connection: unknown): connection is readonly string[] {
  return Array.isArray(connection);
}

function asList(connection: string | readonly string[]): readonly string[] {
  return typeof connection === 'string' ? [connection] : connection;
}

// A hook that throws must not leave a message unacknowledged or stop a reconnection.
function guarded<T>(hook: ((value: T) => void) | undefined): (value: T) => void {
  return (value) => {
    try {
      hook?.(value);
    } catch {
      return;
    }
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
