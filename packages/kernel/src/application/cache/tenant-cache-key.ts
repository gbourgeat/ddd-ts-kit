import type { ExecutionScope } from '../ports/execution-scope.js';
import { tenantKey } from '../tenancy/tenant-key.js';
import { type CacheKey, cacheKey } from './cache-key.js';

/** `cacheKey` confined to the tenant of the work in progress: what one tenant cached is never served to another. */
export function tenantCacheKey<T>(scope: ExecutionScope, ...segments: readonly string[]): CacheKey<T> {
  return cacheKey<T>(tenantKey(scope, ...segments));
}
