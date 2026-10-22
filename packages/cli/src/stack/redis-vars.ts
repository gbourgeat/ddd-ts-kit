import type { Config } from '../config';
import type { RenderContext } from '../templating';

/** One Redis protocol server for whatever asks for one: the cache, the lock, the rate limiter and the relay signal, the streams of the event bus. */
export function redisVars(config: Config): RenderContext {
  const { cache, broker } = config.stack;
  const streams = broker === 'redis';

  const uses = [
    ...(cache === 'redis' ? ['cache, lock of the scheduled jobs, rate limiter, wake-up of the outbox relay'] : []),
    ...(streams ? ['streams of the integration events'] : []),
  ];

  return {
    server: cache === 'redis' || streams,
    streams,
    service: cache === 'redis' ? 'cache' : 'streams',
    uses: uses.join(', '),
  };
}
