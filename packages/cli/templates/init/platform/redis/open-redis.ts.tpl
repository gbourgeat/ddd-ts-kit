import type { Cache, {{#if queue.redis}}ErrorReporter, {{/if}}Lock, {{#if queue.redis}}Logger, {{/if}}Metrics, RateLimiter } from '@ddd-ts-kit/kernel';
{{#if cache.relaySignal}}
import {
  RedisCache,
  {{#if queue.redis}}
  RedisJobStore,
  {{/if}}
  RedisLock,
  RedisRateLimiter,
  RedisRelaySignal,
  connectRedis,
  redisHealth,
  {{#if queue.redis}}
  reportLostJobs,
  {{/if}}
} from '@ddd-ts-kit/redis';
{{/if}}
{{#unless cache.relaySignal}}
{{#if queue.redis}}
import {
  RedisCache,
  RedisJobStore,
  RedisLock,
  RedisRateLimiter,
  connectRedis,
  redisHealth,
  reportLostJobs,
} from '@ddd-ts-kit/redis';
{{/if}}
{{#unless queue.redis}}
import { RedisCache, RedisLock, RedisRateLimiter, connectRedis, redisHealth } from '@ddd-ts-kit/redis';
{{/unless}}
{{/unless}}
{{#if queue.redis}}
import type { JobStore } from '@ddd-ts-kit/scheduling';
{{/if}}

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
  {{#if queue.redis}}
  /**
   * The background jobs: added once the command that enqueues them committed, claimed by every
   * worker. A write lost after the commit (the server away) is logged and reported.
   */
  jobs(logger: Logger, errors?: ErrorReporter): JobStore;
  {{/if}}
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
    {{#if queue.redis}}
    jobs: (logger, errors) =>
      new RedisJobStore(connection.client, {
        namespace: serviceName + ':jobs',
        onLostJob: reportLostJobs(logger, errors),
      }),
    {{/if}}
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
