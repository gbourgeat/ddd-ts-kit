import { tenantScopeOf, type ExecutionScope, type TenantScoped } from '@ddd-ts-kit/kernel';

/**
 * The condition of an update or a delete, spread into its criteria: the one tenant of the work
 * in progress, whatever an elevation widens. An insert spreads `tenantScopeOf(this.scope)` into
 * its row, the same object, so a row is written in the tenant that reads it back.
 */
export function ownTenantWhere(scope: ExecutionScope): TenantScoped {
  return tenantScopeOf(scope);
}
