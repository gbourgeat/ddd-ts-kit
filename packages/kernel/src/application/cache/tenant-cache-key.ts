import type { ExecutionScope } from '../ports/execution-scope';
import { tenantKey } from '../tenancy/tenant-key';
import { type CacheKey, cacheKey } from './cache-key';

/** `cacheKey` confined to the tenant of the work in progress: what one tenant cached is never served to another. */
export function tenantCacheKey<T>(scope: ExecutionScope, ...segments: readonly string[]): CacheKey<T> {
  return cacheKey<T>(tenantKey(scope, ...segments));
}
