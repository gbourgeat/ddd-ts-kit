import type { CacheKey } from '../cache/cache-key.js';

export interface CacheEntryOptions {
  /** Time to live. Without it the entry stays until deleted or evicted. */
  readonly ttlMs?: number;
}

/**
 * A place for values that can be computed again. A miss and an expired entry both answer
 * `undefined`. Never the source of truth, never behind a repository: see `cached` of
 * `@ddd-ts-kit/aspects`.
 */
export abstract class Cache {
  static readonly tokenKey = 'kernel.Cache';

  abstract get<T>(key: CacheKey<T>): Promise<T | undefined>;

  abstract set<T>(key: CacheKey<T>, value: T, options?: CacheEntryOptions): Promise<void>;

  abstract delete(key: CacheKey<unknown>): Promise<void>;
}
