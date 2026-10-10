import { Redis } from 'ioredis';
import { closeRedis } from './close-redis.js';
import { FAIL_FAST } from './fail-fast.js';
import type { RedisSource } from './redis-source.js';

export interface RedisConnection {
  readonly client: Redis;

  /** Closes the connection when `connectRedis` opened it; a client that was handed over stays open. */
  close(): Promise<void>;
}

/** One connection for every adapter of this package: Redis, Dragonfly and Valkey speak the same protocol. */
export function connectRedis(source: RedisSource): RedisConnection {
  if (source instanceof Redis) return { client: source, close: async () => undefined };

  const client = typeof source === 'string' ? new Redis(source, FAIL_FAST) : new Redis({ ...FAIL_FAST, ...source });

  return { client, close: () => closeRedis(client) };
}
