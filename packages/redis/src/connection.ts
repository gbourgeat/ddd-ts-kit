import { Redis, type RedisOptions } from 'ioredis';

/**
 * The options of ioredis, without the reply mapping ioredis 6 added: the adapters of this
 * package read the replies in their classic shape.
 */
export type RedisConnectionOptions = Omit<RedisOptions, 'replyMapping'>;

/** A client the application already owns, a connection URL, or the options of ioredis. */
export type RedisSource = Redis | RedisConnectionOptions | string;

export interface RedisConnection {
  readonly client: Redis;
  /** Closes the connection when `connectRedis` opened it; a client that was handed over stays open. */
  close(): Promise<void>;
}

/**
 * What a connection opened here adds to the defaults of ioredis, unless the options say
 * otherwise: a command fails after 2 seconds and after one reconnection, instead of waiting
 * for twenty. An adapter of this package then answers its `onError` policy while the server
 * is away, and the application keeps serving.
 */
export const FAIL_FAST: RedisConnectionOptions = Object.freeze({ commandTimeout: 2_000, maxRetriesPerRequest: 1 });

/** One connection for every adapter of this package: Redis, Dragonfly and Valkey speak the same protocol. */
export function connectRedis(source: RedisSource): RedisConnection {
  if (source instanceof Redis) return { client: source, close: async () => undefined };
  const client = typeof source === 'string' ? new Redis(source, FAIL_FAST) : new Redis({ ...FAIL_FAST, ...source });
  return { client, close: () => closeRedis(client) };
}

/** `QUIT` when the connection is up, a plain disconnection otherwise. Resolves once the socket is closed. */
export async function closeRedis(client: Redis): Promise<void> {
  if (client.status === 'end') return;
  // Between two attempts there is no socket whose closing could be awaited.
  const closing = client.status === 'reconnecting' ? Promise.resolve() : ended(client);
  // A connection that is not ready would queue the QUIT until it is, and may never be.
  if (client.status === 'ready') await client.quit().catch(() => undefined);
  client.disconnect();
  await closing;
}

function ended(client: Redis): Promise<void> {
  return new Promise((resolve) => {
    client.once('end', resolve);
  });
}

export type RedisHealth =
  | { readonly status: 'up'; readonly latencyMs: number }
  | { readonly status: 'down'; readonly reason: 'timeout' | 'unreachable' };

export interface RedisHealthOptions {
  /** Default 1000. */
  readonly timeoutMs?: number;
}

/** For a readiness probe: one `PING`, an answer within the timeout, and never an exception. */
export async function redisHealth(client: Redis, options: RedisHealthOptions = {}): Promise<RedisHealth> {
  const started = performance.now();
  const timer = new AbortController();
  try {
    const answered = await Promise.race([client.ping().then(() => true), expiry(options.timeoutMs ?? 1_000, timer.signal)]);
    return answered ? { status: 'up', latencyMs: Math.round(performance.now() - started) } : { status: 'down', reason: 'timeout' };
  } catch {
    return { status: 'down', reason: 'unreachable' };
  } finally {
    timer.abort();
  }
}

function expiry(ms: number, cancelled: AbortSignal): Promise<false> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(false);
    }, ms);
    cancelled.addEventListener('abort', () => {
      clearTimeout(timeout);
    });
  });
}
