import type { RedisOptions } from 'ioredis';

/**
 * The options of ioredis, without the reply mapping ioredis 6 added: the adapters of this
 * package read the replies in their classic shape.
 */
export type RedisConnectionOptions = Omit<RedisOptions, 'replyMapping'>;
