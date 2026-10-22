import type { CacheInvalidation } from '../../application/ports/cache-invalidation';

/** Remembers the tags the use cases asked to purge, for a spec to read: `invalidated`, in order. */
export class InMemoryCacheInvalidation implements CacheInvalidation {
  readonly invalidated: string[] = [];

  async invalidate(tags: readonly string[]): Promise<void> {
    this.invalidated.push(...tags);
  }
}
