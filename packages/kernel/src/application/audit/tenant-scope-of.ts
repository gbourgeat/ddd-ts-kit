import type { ExecutionScope } from '../ports/execution-scope.js';
import { NoCurrentTenantError } from './no-current-tenant-error.js';
import type { TenantScoped } from './tenant-scoped.js';

/** For a repository adapter scoping a statement: the tenant of the work in progress. */
export function tenantScopeOf(scope: ExecutionScope): TenantScoped {
  const { tenantId } = scope.require();

  if (tenantId === undefined) throw new NoCurrentTenantError();

  return { tenantId };
}
