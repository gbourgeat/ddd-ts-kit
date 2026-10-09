declare const VALUE: unique symbol;

/** Names an entry and carries the type of its value, so `get` and `set` agree without a cast. */
export interface CacheKey<T> {
  readonly name: string;
  readonly [VALUE]?: T;
}

/**
 * `cacheKey<Quote>('quote', pair)`: the segments are joined with `:`. Declare one function per
 * family of entries, next to the port that owns them.
 */
export function cacheKey<T>(...segments: readonly string[]): CacheKey<T> {
  return { name: segments.join(':') };
}

export interface CacheEntryOptions {
  /** Time to live. Without it the entry stays until deleted or evicted. */
  readonly ttlMs?: number;
}

/**
 * A place for values that can be computed again. A miss and an expired entry both answer
 * `undefined`. Never the source of truth, never behind a repository: see `cached` of
 * `@ddd-ts-kit/aspects`.
 */
export interface Cache {
  get<T>(key: CacheKey<T>): Promise<T | undefined>;
  set<T>(key: CacheKey<T>, value: T, options?: CacheEntryOptions): Promise<void>;
  delete(key: CacheKey<unknown>): Promise<void>;
}
