import type { CacheKey } from '../../application/cache/cache-key.js';
import type { Cache, CacheEntryOptions } from '../../application/ports/cache.js';
import type { Clock } from '../../application/ports/clock.js';

export interface InMemoryCacheOptions {
  /** Beyond it the oldest entry goes. Default 1000. */
  readonly maxEntries?: number;
}

interface Entry {
  readonly value: unknown;
  readonly expiresAt?: number;
}

const DEFAULT_MAX_ENTRIES = 1000;

/**
 * A bounded map in the memory of the process, with expiry read from the `Clock`. Fine for one
 * instance and for tests; several instances share nothing.
 */
export class InMemoryCache implements Cache {
  private readonly entries = new Map<string, Entry>();

  private readonly maxEntries: number;

  constructor(
    private readonly clock: Clock,
    options: InMemoryCacheOptions = {},
  ) {
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  }

  get size(): number {
    return this.entries.size;
  }

  async get<T>(key: CacheKey<T>): Promise<T | undefined> {
    const entry = this.entries.get(key.name);

    if (entry === undefined) {
      return undefined;
    }

    if (entry.expiresAt !== undefined && entry.expiresAt <= this.clock.now().getTime()) {
      this.entries.delete(key.name);

      return undefined;
    }

    // eslint-disable-next-line ddd-ts-kit/clean-no-escape-hatch -- entries of every type share one map: the link between a key and the type of its value is only known to the CacheKey that wrote it
    return entry.value as T;
  }

  async set<T>(key: CacheKey<T>, value: T, options: CacheEntryOptions = {}): Promise<void> {
    this.entries.delete(key.name);

    this.entries.set(key.name, {
      value,
      ...(options.ttlMs === undefined ? {} : { expiresAt: this.clock.now().getTime() + options.ttlMs }),
    });

    this.evictBeyondCapacity();
  }

  async delete(key: CacheKey<unknown>): Promise<void> {
    this.entries.delete(key.name);
  }

  private evictBeyondCapacity(): void {
    for (const name of this.entries.keys()) {
      if (this.entries.size <= this.maxEntries) {
        return;
      }

      this.entries.delete(name);
    }
  }
}
