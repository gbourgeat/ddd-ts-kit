import type { NatsConnection, NodeConnectionOptions } from '@nats-io/transport-node';
import { DEFAULT_STREAM, DEFAULT_SUBJECT_PREFIX, type NatsEventBusOptions } from './nats-event-bus-options.js';
import type { ReconnectOptions } from './reconnect-options.js';
import type { RetryOptions } from './retry-options.js';
import type { Settings } from './settings.js';

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
  const given =
    typeof connection === 'string' || isList(connection) ? { servers: [...asList(connection)] } : connection;

  return { maxReconnectAttempts: -1, reconnectTimeWait: reconnect.initialMs, ...given };
}

function isList(connection: unknown): connection is readonly string[] {
  return Array.isArray(connection);
}

function asList(connection: string | readonly string[]): readonly string[] {
  return typeof connection === 'string' ? [connection] : connection;
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
