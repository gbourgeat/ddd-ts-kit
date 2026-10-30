import { tenantReachOf, type ExecutionScope } from '@ddd-ts-kit/kernel';

/** The condition on `tenantId` a read spreads into its `where`: one tenant, the tenants of an elevation, or nothing under an elevation over every tenant. */
export interface TenantWhere {
  readonly tenantId?: string | { readonly in: string[] };
}

/**
 * The condition every read of a model of tenant data spreads into its `where`:
 * `findFirst({ where: { id, ...tenantWhere(this.scope) } })`. The tenant of the work, or the
 * tenants of an elevation; work that names no tenant is refused (`NoCurrentTenantError`). The
 * one way a repository of a tenant-scoped project reads (`tenancy/scoped-statement`): `findUnique`
 * reaches a row by its key, which the tenant is never part of. Writes use `ownTenantWhere`,
 * which an elevation does not widen. The spread stays at the top of the `where`, an `OR` beside
 * it: under an `OR`, a `NOT` or a relation it holds for one branch alone.
 */
export function tenantWhere(scope: ExecutionScope): TenantWhere {
  const reach = tenantReachOf(scope);

  if (reach.kind === 'tenant') {
    return { tenantId: reach.tenantId };
  }

  return reach.tenants === 'all' ? {} : { tenantId: { in: [...reach.tenants] } };
}
