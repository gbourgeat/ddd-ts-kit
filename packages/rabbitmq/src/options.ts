import type { ChannelModel, Options } from 'amqplib';

export type QueueType = 'quorum' | 'classic';

export interface RetryOptions {
  /** Deliveries after which a message goes to the dead queue. Default 5. */
  readonly maxAttempts?: number;
  /** Time a failed message waits before it is delivered again. Default 5000. */
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

export type RabbitMqFailure =
  | {
      readonly kind: 'handler';
      readonly queue: string;
      readonly eventId: string;
      readonly eventType: string;
      readonly code: string;
      readonly attempt: number;
      readonly dead: boolean;
    }
  | { readonly kind: 'poison'; readonly queue: string; readonly code: string }
  | { readonly kind: 'connection'; readonly code: string };

/** One message settled by a consumer of this bus. Counted by outcome, it is the metric to watch. */
export interface RabbitMqDelivery {
  readonly queue: string;
  /** Which delivery of the message this was, starting at 1. */
  readonly attempt: number;
  /**
   * `acknowledged`: every handler resolved. `retried`: sent to wait for another delivery.
   * `dead`: attempts spent, moved to the dead queue. `poison`: not an envelope, moved there too.
   */
  readonly outcome: 'acknowledged' | 'retried' | 'dead' | 'poison';
}

export interface RabbitMqEventBusOptions {
  /**
   * An AMQP URL, amqplib connection options, or a factory opening a NEW connection each time
   * it is called (TLS, rotating credentials). The bus owns what it opens and closes it.
   */
  readonly connection: string | Options.Connect | (() => Promise<ChannelModel>);
  /** The durable topic exchange events are published to. Default `integration-events`. */
  readonly exchange?: string;
  /** The consuming context `subscribe` declares its queues for. See also `forConsumer`. */
  readonly consumer?: string;
  /** Unacknowledged messages a queue hands to this bus at once. Default 10. */
  readonly prefetch?: number;
  /** Default `quorum`. */
  readonly queueType?: QueueType;
  /** What `publish` does with an event no queue is bound for. Default `ignore`. */
  readonly onUnroutable?: 'ignore' | 'fail';
  readonly retry?: RetryOptions;
  readonly reconnect?: ReconnectOptions;
  /** Observability hook. It receives codes only, so it is safe to log as is. */
  readonly onFailure?: (failure: RabbitMqFailure) => void;
  /** Metrics hook, called once per message a consumer settles, before it is acknowledged. */
  readonly onDelivery?: (delivery: RabbitMqDelivery) => void;
}

export interface Settings {
  readonly open: () => Promise<ChannelModel>;
  readonly exchange: string;
  readonly consumer: string | undefined;
  readonly prefetch: number;
  readonly queueType: QueueType;
  readonly failOnUnroutable: boolean;
  readonly retry: Required<RetryOptions>;
  readonly reconnect: Required<ReconnectOptions>;
  readonly onFailure: (failure: RabbitMqFailure) => void;
  readonly onDelivery: (delivery: RabbitMqDelivery) => void;
}

export const DEFAULT_EXCHANGE = 'integration-events';

export function settingsOf(
  options: RabbitMqEventBusOptions,
  connect: (target: string | Options.Connect) => Promise<ChannelModel>,
): Settings {
  const { connection } = options;
  return {
    open: typeof connection === 'function' ? connection : () => connect(connection),
    exchange: options.exchange ?? DEFAULT_EXCHANGE,
    consumer: options.consumer,
    prefetch: options.prefetch ?? 10,
    queueType: options.queueType ?? 'quorum',
    failOnUnroutable: options.onUnroutable === 'fail',
    retry: retryOf(options.retry),
    reconnect: reconnectOf(options.reconnect),
    onFailure: guarded(options.onFailure),
    onDelivery: guarded(options.onDelivery),
  };
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
