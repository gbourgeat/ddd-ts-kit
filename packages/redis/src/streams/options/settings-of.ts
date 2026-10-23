import { hostname } from 'node:os';
import { randomBytes } from 'node:crypto';
import { DEFAULT_PREFIX } from './default-prefix';
import type { ReconnectOptions } from './reconnect-options';
import type { RedisStreamsEventBusOptions } from './redis-streams-event-bus-options';
import type { RetryOptions } from './retry-options';
import type { Settings } from './settings';

export function settingsOf(options: RedisStreamsEventBusOptions): Settings {
  const prefix = options.prefix ?? DEFAULT_PREFIX;

  return {
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
