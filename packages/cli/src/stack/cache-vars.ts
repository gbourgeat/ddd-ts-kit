import type { Config } from '../config/index.js';
import type { RenderContext } from '../templating/index.js';

/** What a Redis protocol server brings: the cache, the lock between processes, the limiter in front of HTTP, and the wake-up of the outbox relay. */
export function cacheVars(config: Config): RenderContext {
  const redis = config.stack.cache === 'redis';
  const { http, events } = config.stack;

  return { redis, none: !redis, rateLimit: redis && http !== 'none', relaySignal: redis && events === 'outbox' };
}
