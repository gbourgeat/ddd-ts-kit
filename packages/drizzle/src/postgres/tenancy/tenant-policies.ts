import { sql } from 'drizzle-orm';
import { pgPolicy, type PgColumn, type PgPolicy } from 'drizzle-orm/pg-core';
import { TENANT_ISOLATION_POLICIES, tenantPolicyExpressions } from '@ddd-ts-kit/kernel';

/**
 * The row-level security policies of a table of tenant data, one per command, declared with the
 * table so that drizzle-kit generates them:
 * `pgTable('invoices', {...}, (table) => [...tenantPolicies(table.tenantId)]).enableRLS()`.
 * A select sees the tenant of the work and the tenants an elevation reaches; an insert, an
 * update and a delete only ever touch `ddd_ts_kit.tenant_id`, elevated or not. drizzle-kit does
 * not force the policies on the owner of the table: add `forceRowLevelSecurity(table)` to a
 * custom migration, or connect with a role that does not own it.
 */
export function tenantPolicies(column: PgColumn): readonly PgPolicy[] {
  const { read, write } = tenantPolicyExpressions(`"${column.name}"`);

  return [
    pgPolicy(TENANT_ISOLATION_POLICIES.select, { as: 'permissive', for: 'select', using: sql.raw(read) }),
    pgPolicy(TENANT_ISOLATION_POLICIES.insert, { as: 'permissive', for: 'insert', withCheck: sql.raw(write) }),
    pgPolicy(TENANT_ISOLATION_POLICIES.update, {
      as: 'permissive',
      for: 'update',
      using: sql.raw(write),
      withCheck: sql.raw(write),
    }),
    pgPolicy(TENANT_ISOLATION_POLICIES.delete, { as: 'permissive', for: 'delete', using: sql.raw(write) }),
  ];
}
