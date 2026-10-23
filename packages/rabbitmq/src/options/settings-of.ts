import type { ChannelModel, Options } from 'amqplib';
import { DEFAULT_EXCHANGE, type RabbitMqEventBusOptions } from './rabbit-mq-event-bus-options';
import type { ReconnectOptions } from './reconnect-options';
import type { RetryOptions } from './retry-options';
import type { Settings } from './settings';

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
