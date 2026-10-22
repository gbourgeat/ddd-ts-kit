import type { RedisConnectionOptions } from './redis-connection-options';

/**
 * What a connection opened here adds to the defaults of ioredis, unless the options say
 * otherwise: a command fails after 2 seconds and after one reconnection, instead of waiting
 * for twenty. An adapter of this package then answers its `onError` policy while the server
 * is away, and the application keeps serving.
 */
export const FAIL_FAST: RedisConnectionOptions = Object.freeze({ commandTimeout: 2_000, maxRetriesPerRequest: 1 });
