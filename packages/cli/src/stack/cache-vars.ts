import type { Config } from '../config';
import type { RenderContext } from '../templating';
import { WITH_DATABASE } from './with-database';

/**
 * What a Redis protocol server brings: the cache, the lock between processes, the limiter in front
 * of HTTP, and the wake-up of the outbox relay of another process. An outbox kept in the memory of
 * the process (no database) is relayed by that process alone, which its own store wakes.
 */
export function cacheVars(config: Config): RenderContext {
  const redis = config.stack.cache === 'redis';
  const { http, events, orm } = config.stack;
  const relaySignal = redis && events === 'outbox' && WITH_DATABASE.includes(orm);

  return { redis, none: !redis, rateLimit: redis && http !== 'none', relaySignal };
}
