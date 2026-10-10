import type { Redis } from 'ioredis';

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
