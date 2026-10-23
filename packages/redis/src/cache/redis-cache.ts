import { inspect } from 'node:util';
import type { Redis } from 'ioredis';
import {
  NoopMetrics,
  type Cache,
  type CacheEntryOptions,
  type CacheKey,
  type Counter,
  type Lock,
  type Metrics,
} from '@ddd-ts-kit/kernel';
import { namespaced } from '../keys/namespaced';
import { prefixPattern } from '../keys/prefix-pattern';
import { conceal } from '../secrecy/conceal';
import type { CacheCodec } from './cache-codec';
import type { CacheOperation } from './cache-operation';
import { jsonCodec } from './json-codec';

export interface RedisCacheOptions {
  /** Prefix of every key, typically the bounded context: two contexts never read each other's entries. */
  readonly namespace?: string;

  readonly codec?: CacheCodec;

  /**
   * What a failing server costs. `miss` (default): a read answers `undefined`, a write is
   * dropped, and the application runs without its cache. `throw`: the failure reaches the caller.
   */
  readonly onError?: 'miss' | 'throw';

  /** Counts the failures as `cache_errors_total`, by operation and namespace. */
  readonly metrics?: Metrics;

  /** Lets `getOrLoad` compute a missing value in one process only: see there. */
  readonly lock?: Lock;
}

export interface LoadOptions extends CacheEntryOptions {
  /** How long one process may take to compute the value before another one tries. Default 10000. */
  readonly lockTtlMs?: number;

  /** How long the others wait for that value before computing it themselves. Default 2000. */
  readonly waitMs?: number;
}

const SCAN_BATCH = 200;
const DESCRIPTION = 'RedisCache [client concealed]';

/**
 * The kernel `Cache` on the Redis protocol. A value that can be computed again, never the
 * source of truth: by default a server that is away costs a miss, not a failure.
 */
export class RedisCache implements Cache {
  private readonly client: Redis;

  private readonly namespace: string | undefined;

  private readonly codec: CacheCodec;

  private readonly failing: boolean;

  private readonly errors: Counter;

  private readonly lock: Lock | undefined;

  private readonly loading = new Map<string, Promise<unknown>>();

  constructor(client: Redis, options: RedisCacheOptions = {}) {
    this.client = client;
    this.namespace = options.namespace;
    this.codec = options.codec ?? jsonCodec;
    this.failing = options.onError === 'throw';
    this.errors = (options.metrics ?? new NoopMetrics()).counter('cache_errors_total');
    this.lock = options.lock;
    conceal(this);
  }

  async get<T>(key: CacheKey<T>): Promise<T | undefined> {
    const text = await this.guarded('get', () => this.client.get(this.keyOf(key.name)));

    if (text === undefined || text === null) {
      return undefined;
    }

    return this.guarded('get', async () => {
      // eslint-disable-next-line ddd-ts-kit/clean-no-escape-hatch -- the server holds text: the link between a key and the type of its value is only known to the CacheKey that wrote it
      return this.codec.decode(text) as T;
    });
  }

  async set<T>(key: CacheKey<T>, value: T, options: CacheEntryOptions = {}): Promise<void> {
    const name = this.keyOf(key.name);
    const { ttlMs } = options;

    await this.guarded('set', async () => {
      if (ttlMs === undefined) {
        await this.client.set(name, this.codec.encode(value));
      } else if (ttlMs <= 0) {
        await this.client.del(name);
      } else {
        await this.client.set(name, this.codec.encode(value), 'PX', Math.ceil(ttlMs));
      }
    });
  }

  async delete(key: CacheKey<unknown>): Promise<void> {
    await this.guarded('delete', () => this.client.del(this.keyOf(key.name)));
  }

  /**
   * Deletes every entry of the namespace whose name starts with the prefix, and says how
   * many. Walks the keys with `SCAN`, never `KEYS`: the server keeps answering meanwhile, and
   * an entry written during the walk may be missed.
   */
  async deleteByPrefix(prefix: string): Promise<number> {
    const deleted = await this.guarded('delete', () => this.deleteMatching(prefixPattern(this.keyOf(prefix))));

    return deleted ?? 0;
  }

  /**
   * Reads the entry, or computes it once and stores it. Concurrent callers of one process
   * share a single computation. With a `lock`, the processes share it too: one computes, the
   * others wait for its value up to `waitMs`, then compute it themselves rather than fail.
   * `cached` of `@ddd-ts-kit/aspects` already shares the call inside a process; this is for
   * the value that is expensive enough to protect across instances.
   */
  async getOrLoad<T>(key: CacheKey<T>, load: () => Promise<T>, options: LoadOptions = {}): Promise<T> {
    const hit = await this.get(key);

    if (hit !== undefined) {
      return hit;
    }

    const pending =
      this.loading.get(key.name) ?? this.loadOnce(key, load, options).finally(() => this.loading.delete(key.name));

    this.loading.set(key.name, pending);

    // eslint-disable-next-line ddd-ts-kit/clean-no-escape-hatch -- computations of every type share one map: the one stored under this name was started with this key
    return pending as Promise<T>;
  }

  /** What a serialisation shows: a name, never the client, whose options carry the password. */
  toJSON(): string {
    return DESCRIPTION;
  }

  /** What `console.log` and `util.inspect` show: the same. */
  [inspect.custom](): string {
    return DESCRIPTION;
  }

  private keyOf(name: string): string {
    return namespaced(this.namespace, name);
  }

  private async guarded<R>(operation: CacheOperation, work: () => Promise<R>): Promise<R | undefined> {
    try {
      return await work();
    } catch (error) {
      this.errors.increment({ operation, ...(this.namespace === undefined ? {} : { context: this.namespace }) });

      if (this.failing) {
        throw error;
      }

      return undefined;
    }
  }

  private async deleteMatching(pattern: string): Promise<number> {
    let cursor = '0';
    let deleted = 0;

    do {
      const [next, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', SCAN_BATCH);

      // One key per command: a cluster refuses a DEL whose keys live in different slots.
      for (const key of keys) {
        deleted += await this.client.del(key);
      }

      cursor = next;
    } while (cursor !== '0');

    return deleted;
  }

  private async loadOnce<T>(key: CacheKey<T>, load: () => Promise<T>, options: LoadOptions): Promise<T> {
    const handle = await this.lockFor(key.name, options);

    try {
      const filled = this.lock === undefined ? undefined : await this.get(key);

      if (filled !== undefined) {
        return filled;
      }

      const value = await load();

      await this.set(key, value, options.ttlMs === undefined ? {} : { ttlMs: options.ttlMs });

      return value;
    } finally {
      await handle?.release().catch(() => undefined);
    }
  }

  private async lockFor(name: string, options: LoadOptions): Promise<{ release(): Promise<void> } | undefined> {
    try {
      return await this.lock?.acquire(`cache:${this.keyOf(name)}`, {
        ttlMs: options.lockTtlMs ?? 10_000,
        waitMs: options.waitMs ?? 2_000,
      });
    } catch {
      return undefined;
    }
  }
}
