import { hostname } from 'node:os';
import { randomBytes } from 'node:crypto';
import type { ExecutionScope } from '@ddd-ts-kit/kernel';
import type { RedisSource } from '../connection.js';

export interface RetryOptions {
  /** Deliveries after which an entry goes to the dead stream. Default 5. */
  readonly maxAttempts?: number;
  /** Time a failed entry waits before it is delivered again. Default 5000. */
  readonly delayMs?: number;
}

export interface ReconnectOptions {
  /** Delay before the first reconnection attempt. Default 200. */
  readonly initialMs?: number;
  /** Multiplier applied at each further attempt. Default 2. */
  readonly factor?: number;
  /** Upper bound of the delay. Default 30000. */
  readonly maxMs?: number;
}

/**
 * Trimming applied by each publication, approximately (`~`). It drops the oldest entries
 * whether or not every consumer group has read them: an opt-in, never a default.
 */
export type RetentionOptions =
  | { /** Keep about this many entries per stream (`MAXLEN ~`). */ readonly maxLength: number }
  | { /** Keep the entries younger than this (`MINID ~`), by the clock of the publisher. */ readonly maxAgeMs: number };

export interface DeduplicationOptions {
  /** How long the id of a published event is remembered. A relay retry within it appends nothing. */
  readonly windowMs: number;
}

export type RedisStreamsFailure =
  | {
      readonly kind: 'handler';
      readonly stream: string;
      readonly consumer: string;
      readonly eventId: string;
      readonly eventType: string;
      readonly code: string;
      readonly attempt: number;
      readonly dead: boolean;
    }
  | { readonly kind: 'poison'; readonly stream: string; readonly consumer: string; readonly code: string }
  | { readonly kind: 'connection'; readonly code: string };

/** One entry settled by a consumer of this bus. Counted by outcome, it is the metric to watch. */
export interface RedisStreamsDelivery {
  readonly stream: string;
  readonly consumer: string;
  /** Which delivery of the entry this was, starting at 1: the delivery counter of the pending entry list. */
  readonly attempt: number;
  /**
   * `acknowledged`: every handler resolved. `retried`: left pending for another delivery.
   * `dead`: attempts spent, moved to the dead stream. `poison`: not an envelope, moved there too.
   */
  readonly outcome: 'acknowledged' | 'retried' | 'dead' | 'poison';
}

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

export interface Settings {
  readonly connection: RedisSource;
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

export const DEFAULT_PREFIX = 'integration-events';

export function settingsOf(options: RedisStreamsEventBusOptions): Settings {
  const prefix = options.prefix ?? DEFAULT_PREFIX;
  return {
    connection: options.connection,
    streamOf: options.streamOf ?? ((type) => `${prefix}:${type}`),
    consumer: options.consumer,
    instance: options.instance ?? processName(),
    batchSize: options.batchSize ?? 10,
    blockMs: options.blockMs ?? 1_000,
    visibilityTimeoutMs: options.visibilityTimeoutMs ?? 60_000,
    startFrom: options.startFrom ?? 'new',
    retry: retryOf(options.retry),
    reconnect: reconnectOf(options.reconnect),
    retention: options.retention,
    deduplication: options.deduplication,
    scope: options.scope,
    onFailure: guarded(options.onFailure),
    onDelivery: guarded(options.onDelivery),
  };
}

/** The delay before the given attempt, counted from 1: it grows by the factor up to the bound. */
export function reconnectDelay(reconnect: Required<ReconnectOptions>, attempt: number): number {
  return Math.min(reconnect.maxMs, reconnect.initialMs * reconnect.factor ** (attempt - 1));
}

function processName(): string {
  return `${hostname()}-${String(process.pid)}-${randomBytes(4).toString('hex')}`;
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

// A hook that throws must not leave an entry unsettled or stop a reader.
function guarded<T>(hook: ((value: T) => void) | undefined): (value: T) => void {
  return (value) => {
    try {
      hook?.(value);
    } catch {
      return;
    }
  };
}
