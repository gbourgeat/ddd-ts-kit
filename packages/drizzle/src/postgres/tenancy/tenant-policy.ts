import { sql } from 'drizzle-orm';
import { pgPolicy, type PgColumn, type PgPolicy } from 'drizzle-orm/pg-core';
import { TENANT_ISOLATION_POLICY, tenantPolicyExpressions } from '@ddd-ts-kit/kernel';

/**
 * The row-level security policy of a table of tenant data, declared with the table so that
 * drizzle-kit generates it: `pgTable('invoices', {...}, (table) => [tenantPolicy(table.tenantId)]).enableRLS()`.
 * A read sees the tenants of `ddd_ts_kit.reach`, a write may only name `ddd_ts_kit.tenant_id`.
 * drizzle-kit does not force the policy on the owner of the table: add
 * `forceRowLevelSecurity(table)` to a custom migration, or connect with a role that does not own it.
 */
export function tenantPolicy(column: PgColumn): PgPolicy {
  const { using, withCheck } = tenantPolicyExpressions(`"${column.name}"`);

  return pgPolicy(TENANT_ISOLATION_POLICY, {
    as: 'permissive',
    for: 'all',
    using: sql.raw(using),
    withCheck: sql.raw(withCheck),
  });
}
