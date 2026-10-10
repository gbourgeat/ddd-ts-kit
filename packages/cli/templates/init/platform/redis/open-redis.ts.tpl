import type { Cache, Lock, Metrics, RateLimiter } from '@ddd-ts-kit/kernel';
{{#if cache.relaySignal}}
import {
  RedisCache,
  RedisLock,
  RedisRateLimiter,
  RedisRelaySignal,
  connectRedis,
  redisHealth,
} from '@ddd-ts-kit/redis';
{{/if}}
{{#unless cache.relaySignal}}
import { RedisCache, RedisLock, RedisRateLimiter, connectRedis, redisHealth } from '@ddd-ts-kit/redis';
{{/unless}}

/**
 * What the platform puts on one connection to a Redis protocol server. The adapters use a common
 * subset of the protocol: Redis, Dragonfly and Valkey are interchangeable behind `REDIS_URL`.
 */
export interface RedisServices {
  /** The kernel `Cache` port. A server that is away costs a miss, never an exception: watch `cache_errors_total`. */
  cache(metrics: Metrics): Cache;

  /** Counts across every instance of the service. */
  readonly rateLimiter: RateLimiter;
  /** Excludes between processes: what keeps an occurrence of a scheduled job to one instance, best effort. */
  readonly lock: Lock;
  {{#if cache.relaySignal}}
  /** Wakes the outbox relay of every instance as soon as a command committed; the polling interval stays as the safety net. */
  readonly relaySignal: RedisRelaySignal;
  {{/if}}

  /** One `PING` answered in time: for the readiness probe. */
  ready(): Promise<boolean>;

  close(): Promise<void>;
}

interface RedisSettings {
  readonly redisUrl: string;
  /** Prefix of every key, so that several services share one server. */
  readonly serviceName: string;
}

export function openRedis({ redisUrl, serviceName }: RedisSettings): RedisServices {
  const connection = connectRedis(redisUrl);
  {{#if cache.relaySignal}}
  const relaySignal = new RedisRelaySignal(connection.client, { channel: serviceName + ':outbox' });
  {{/if}}

  return {
    cache: (metrics) => new RedisCache(connection.client, { namespace: serviceName, metrics }),
    // While the server is away the API keeps serving, without a limit: a limiter must not take the application down.
    rateLimiter: new RedisRateLimiter(connection.client, { namespace: serviceName + ':rate', onError: 'allow' }),
    lock: new RedisLock(connection.client, { namespace: serviceName + ':lock' }),
    {{#if cache.relaySignal}}
    relaySignal,
    {{/if}}
    ready: async () => (await redisHealth(connection.client)).status === 'up',
    {{#if cache.relaySignal}}
    close: async () => {
      await relaySignal.close();
      await connection.close();
    },
    {{/if}}
    {{#unless cache.relaySignal}}
    close: () => connection.close(),
    {{/unless}}
  };
}
