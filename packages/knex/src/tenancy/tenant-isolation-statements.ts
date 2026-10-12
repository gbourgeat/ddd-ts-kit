import { TENANT_ISOLATION_POLICY, tenantPolicyExpressions } from '@ddd-ts-kit/kernel';
import type { TenantTableTarget } from './tenant-table-target.js';
import { TENANT_COLUMN } from './where-tenant.js';

/**
 * The PostgreSQL statements that make the database itself refuse a row of another tenant, the
 * second line behind the tenant condition of every statement: row-level security enabled and
 * forced (so that the owner of the table obeys it too), and one policy. A read sees the rows of
 * the tenants of `ddd_ts_kit.reach`; a write may only name `ddd_ts_kit.tenant_id`. Work that set
 * neither sees nothing and writes nothing. The role of the application must not be a superuser
 * nor have `BYPASSRLS`: both ignore every policy.
 */
export function tenantIsolationStatements(target: TenantTableTarget): readonly string[] {
  const table = qualified(target);
  const { using, withCheck } = tenantPolicyExpressions(quoted(target.column ?? TENANT_COLUMN));

  return [
    `alter table ${table} enable row level security`,
    `alter table ${table} force row level security`,
    `create policy ${TENANT_ISOLATION_POLICY} on ${table} using (${using}) with check (${withCheck})`,
  ];
}

function qualified({ table, schema }: TenantTableTarget): string {
  return schema === undefined ? quoted(table) : `${quoted(schema)}.${quoted(table)}`;
}

function quoted(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}
