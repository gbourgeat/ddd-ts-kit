import type { LockHandle } from '../lock/lock-handle.js';

export interface AcquireOptions {
  /** After it the lock frees itself: the holder crashed, or took longer than it promised. */
  readonly ttlMs: number;
  /** How long to wait for a lock somebody else holds. Default 0: answer at once. */
  readonly waitMs?: number;
}

/**
 * A mutex between processes, to avoid doing the same work twice: `undefined` when somebody
 * else holds the key. An efficiency tool, never the guard of an invariant: what must not
 * happen twice is refused by a database constraint.
 */
export abstract class Lock {
  static readonly tokenKey = 'kernel.Lock';

  abstract acquire(key: string, options: AcquireOptions): Promise<LockHandle | undefined>;
}
