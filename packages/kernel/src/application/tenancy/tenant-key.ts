import type { ExecutionScope } from '../ports/execution-scope.js';
import { tenantScopeOf } from '../audit/tenant-scope-of.js';

/**
 * A key of a shared store (a rate limit, a lock, a counter) confined to the tenant of the work
 * in progress: `tenant:<id>:<segments>`. Two tenants never share an entry, and work that names
 * no tenant is refused instead of reaching a global entry by omission.
 */
export function tenantKey(scope: ExecutionScope, ...segments: readonly string[]): string {
  return ['tenant', tenantScopeOf(scope).tenantId, ...segments].join(':');
}
