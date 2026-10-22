import type { Redis } from 'ioredis';
import type { RedisConnectionOptions } from './redis-connection-options';

/** A client the application already owns, a connection URL, or the options of ioredis. */
export type RedisSource = Redis | RedisConnectionOptions | string;
