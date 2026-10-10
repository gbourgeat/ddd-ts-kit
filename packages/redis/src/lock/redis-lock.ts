import { randomBytes } from 'node:crypto';
import { inspect } from 'node:util';
import type { Redis } from 'ioredis';
import { acquiring, type AcquireOptions, type Lock, type LockHandle, type WaitingOptions } from '@ddd-ts-kit/kernel';
import { namespaced } from '../keys/namespaced.js';
import { conceal } from '../secrecy/conceal.js';

export interface RedisLockOptions extends WaitingOptions {
  /** Prefix of the keys, typically the bounded context. Default `lock`. */
  readonly namespace?: string;
}

/** Takes the lock if it is free and numbers the acquisition, in one step. KEYS: lock, counter. ARGV: owner, ttl. */
const ACQUIRE = `
if redis.call('SET', KEYS[1], ARGV[1], 'NX', 'PX', ARGV[2]) then
  return redis.call('INCR', KEYS[2])
end
return 0`;

/** Deletes the lock only while it still holds the value of this owner. KEYS: lock. ARGV: owner. */
const RELEASE = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0`;

const DESCRIPTION = 'RedisLock [client concealed]';

/**
 * The single-instance lock of the Redis documentation: `SET key owner NX PX ttl`, released by
 * compare-and-delete so that a holder whose lock expired cannot free the lock of the next one.
 *
 * What it guarantees: at most one holder at a time as long as the server keeps its data and
 * the holder finishes within `ttlMs`. What it does not: it is not a consensus lock. A
 * failover to a replica that had not received the key, a restart without persistence, an
 * eviction, or a holder paused longer than the ttl each let two holders in. The fencing
 * token narrows that, for a resource able to compare tokens; its counter lives in the same
 * server and starts again if that server loses it.
 */
export class RedisLock implements Lock {
  private readonly client: Redis;

  private readonly namespace: string;

  private readonly waiting: WaitingOptions;

  constructor(client: Redis, options: RedisLockOptions = {}) {
    this.client = client;
    this.namespace = options.namespace ?? 'lock';
    this.waiting = options;
    conceal(this);
  }

  acquire(key: string, options: AcquireOptions): Promise<LockHandle | undefined> {
    return acquiring(() => this.attempt(key, options.ttlMs), options.waitMs ?? 0, this.waiting);
  }

  /** What a serialisation shows: a name, never the client, whose options carry the password. */
  toJSON(): string {
    return DESCRIPTION;
  }

  /** What `console.log` and `util.inspect` show: the same. */
  [inspect.custom](): string {
    return DESCRIPTION;
  }

  private async attempt(key: string, ttlMs: number): Promise<LockHandle | undefined> {
    // The braces make both keys hash to one slot, which a cluster requires of a script.
    const lockKey = namespaced(this.namespace, `{${key}}`);
    const owner = randomBytes(16).toString('hex');
    const ttl = String(Math.max(1, Math.ceil(ttlMs)));
    const token = Number(await this.client.eval(ACQUIRE, 2, lockKey, `${lockKey}:fence`, owner, ttl));

    if (token === 0) {
      return undefined;
    }

    const release = async (): Promise<void> => {
      await this.client.eval(RELEASE, 1, lockKey, owner);
    };

    return { key, fencingToken: token, release };
  }
}
