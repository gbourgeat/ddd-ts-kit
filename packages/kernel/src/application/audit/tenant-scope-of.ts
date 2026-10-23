import type { ExecutionScope } from '../ports/execution-scope';
import { assertTenantId } from '../tenancy/assert-tenant-id';
import { NoCurrentTenantError } from './no-current-tenant-error';
import type { TenantScoped } from './tenant-scoped';

/**
 * For a repository adapter scoping a statement: the tenant of the work in progress, checked
 * against the grammar of `isTenantId` again however the context was built.
 */
export function tenantScopeOf(scope: ExecutionScope): TenantScoped {
  const { tenantId } = scope.require();

  if (tenantId === undefined) {
    throw new NoCurrentTenantError();
  }

  return { tenantId: assertTenantId(tenantId) };
}
