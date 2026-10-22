import { sql, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import type { ExecutionScope } from '@ddd-ts-kit/kernel';
import { reachCondition } from './reach-condition';

/**
 * The condition every read of a table of tenant data carries: `.where(and(eq(invoices.id, id),
 * tenantCondition(invoices.tenantId, this.scope)))`. The tenant of the work, or the tenants of an
 * elevation; work that names no tenant is refused (`NoCurrentTenantError`). The one way a
 * repository of a tenant-scoped project reads (`tenancy/scoped-statement`); writes use
 * `ownTenantCondition`, which an elevation does not widen.
 */
export function tenantCondition(column: PgColumn, scope: ExecutionScope): SQL {
  return reachCondition(sql`${column}`, scope);
}
