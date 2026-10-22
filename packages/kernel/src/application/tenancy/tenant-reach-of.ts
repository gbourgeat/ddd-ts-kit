import { NoCurrentTenantError } from '../audit/no-current-tenant-error';
import type { ExecutionScope } from '../ports/execution-scope';
import { assertTenantId } from './assert-tenant-id';
import type { TenantReach } from './tenant-reach';

/**
 * For an adapter scoping a read: the tenants it may see. An elevation opened by `acrossTenants`
 * widens it; otherwise it is the tenant of the work, and work that names none is refused, so
 * that no read runs unscoped by omission. Writes keep `tenantScopeOf`: one tenant, always.
 */
export function tenantReachOf(scope: ExecutionScope): TenantReach {
  const { tenantId, elevation } = scope.require();

  if (elevation !== undefined) {
    return { kind: 'elevated', tenants: elevation.tenants === 'all' ? 'all' : elevation.tenants.map(assertTenantId) };
  }

  if (tenantId === undefined) {
    throw new NoCurrentTenantError();
  }

  return { kind: 'tenant', tenantId: assertTenantId(tenantId) };
}
