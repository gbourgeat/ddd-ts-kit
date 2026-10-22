import type { ExecutionScope } from '../ports/execution-scope';
import { tenantScopeOf } from '../audit/tenant-scope-of';

/**
 * A key of a shared store (a rate limit, a lock, a counter) confined to the tenant of the work
 * in progress: `tenant:<id>:<segments>`, each segment percent-encoded so that no segment holds a
 * `:` (`['a:b']` and `['a', 'b']` are two keys). Two tenants never share an entry, and work that
 * names no tenant is refused instead of reaching a global entry by omission.
 */
export function tenantKey(scope: ExecutionScope, ...segments: readonly string[]): string {
  return ['tenant', tenantScopeOf(scope).tenantId, ...segments.map(encodeURIComponent)].join(':');
}
