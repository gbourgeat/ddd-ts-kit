import { In, type FindOperator } from 'typeorm';
import { tenantReachOf, type ExecutionScope } from '@ddd-ts-kit/kernel';

/** The condition on `tenantId` a read spreads into its where: one tenant, the tenants of an elevation (`In`), or nothing under an elevation over every tenant. */
export interface TenantWhere {
  readonly tenantId?: string | FindOperator<string>;
}

/**
 * The condition every read of an entity of tenant data spreads into its where:
 * `findOneBy(invoices, { id, ...tenantWhere(this.scope) })`, or `.where({ id, ...tenantWhere(this.scope) })`
 * on a query builder. The tenant of the work, or the tenants of an elevation; work that names no
 * tenant is refused (`NoCurrentTenantError`). The one way a repository of a tenant-scoped project
 * reads (`tenancy/scoped-statement`). Writes use `ownTenantWhere`, which an elevation does not
 * widen. The spread stays at the top of the where, in each entry of a where array, since the array
 * is an `or` of its entries; a query builder groups its alternatives in `new Brackets(...)`.
 */
export function tenantWhere(scope: ExecutionScope): TenantWhere {
  const reach = tenantReachOf(scope);

  if (reach.kind === 'tenant') {
    return { tenantId: reach.tenantId };
  }

  return reach.tenants === 'all' ? {} : { tenantId: In([...reach.tenants]) };
}
