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
