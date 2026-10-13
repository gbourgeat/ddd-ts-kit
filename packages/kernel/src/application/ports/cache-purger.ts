/**
 * Removes from a shared cache (Varnish, a CDN) every answer filed under one of the tags, now.
 * Idempotent: a tag nothing is filed under purges nothing, and purging twice is purging once.
 * A use case never calls it: it asks `CacheInvalidation`, which purges after its commit.
 */
export abstract class CachePurger {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.CachePurger' });
  }

  abstract purge(tags: readonly string[]): Promise<void>;
}
