import { inspect } from 'node:util';
import { Redis } from 'ioredis';
import { closeRedis } from './close-redis';
import { FAIL_FAST } from './fail-fast';
import type { RedisSource } from './redis-source';

export interface RedisConnection {
  readonly client: Redis;

  /** Closes the connection when `connectRedis` opened it; a client that was handed over stays open. */
  close(): Promise<void>;
}

const DESCRIPTION = 'RedisConnection [client concealed]';

/** One connection for every adapter of this package: Redis, Dragonfly and Valkey speak the same protocol. */
export function connectRedis(source: RedisSource): RedisConnection {
  if (source instanceof Redis) {
    return handedOut(source, async () => undefined);
  }

  const client = typeof source === 'string' ? new Redis(source, FAIL_FAST) : new Redis({ ...FAIL_FAST, ...source });

  return handedOut(client, () => closeRedis(client));
}

/**
 * The client of ioredis shows its options, password included, to whoever inspects it, and
 * that cannot be changed from here. It is reached by name; a log, a spread or a serialisation
 * of the connection does not lead to it.
 */
function handedOut(client: Redis, close: () => Promise<void>): RedisConnection {
  return Object.defineProperties(
    { client, close },
    {
      client: { enumerable: false },
      toJSON: { value: () => DESCRIPTION },
      [inspect.custom]: { value: () => DESCRIPTION },
    },
  );
}
