/**
 * Asks for the answers filed under the tags (`cacheTag('calendar', id)`) to be purged from the
 * shared caches once the work in progress has committed: never when it rolls back, and even when
 * the process stops right after the commit. Called by a `before-commit` handler of the domain
 * event that changed what those answers show. The tags are filed under the tenant of the work.
 */
export abstract class CacheInvalidation {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.CacheInvalidation' });
  }

  abstract invalidate(tags: readonly string[]): Promise<void>;
}
