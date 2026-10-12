import { NoCurrentTenantError } from '../audit/no-current-tenant-error.js';
import type { ExecutionScope } from '../ports/execution-scope.js';
import type { TenantReach } from './tenant-reach.js';

/**
 * For an adapter scoping a read: the tenants it may see. An elevation opened by `acrossTenants`
 * widens it; otherwise it is the tenant of the work, and work that names none is refused, so
 * that no read runs unscoped by omission. Writes keep `tenantScopeOf`: one tenant, always.
 */
export function tenantReachOf(scope: ExecutionScope): TenantReach {
  const { tenantId, elevation } = scope.require();

  if (elevation !== undefined) {
    return { kind: 'elevated', tenants: elevation.tenants };
  }

  if (tenantId === undefined) {
    throw new NoCurrentTenantError();
  }

  return { kind: 'tenant', tenantId };
}
