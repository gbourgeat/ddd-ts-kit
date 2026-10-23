import { TENANT_ISOLATION_POLICIES, tenantPolicyExpressions } from '@ddd-ts-kit/kernel';
import type { TenantTableTarget } from './tenant-table-target';
import { TENANT_COLUMN } from './where-tenant';

/**
 * The PostgreSQL statements that make the database itself refuse a row of another tenant, the
 * second line behind the tenant condition of every statement: row-level security enabled and
 * forced (so that the owner of the table obeys it too), and one policy per command. A select
 * sees the tenant of the work and the tenants an elevation reaches; an insert, an update and a
 * delete only ever touch `ddd_ts_kit.tenant_id`, elevated or not, even without a condition of
 * their own. Work that set nothing sees nothing and writes nothing. The role of the application
 * must not be a superuser nor have `BYPASSRLS`: both ignore every policy.
 */
export function tenantIsolationStatements(target: TenantTableTarget): readonly string[] {
  const table = qualified(target);
  const { read, write } = tenantPolicyExpressions(quoted(target.column ?? TENANT_COLUMN));
  const policy = (name: string, rest: string): string => `create policy ${name} on ${table} ${rest}`;

  return [
    `alter table ${table} enable row level security`,
    `alter table ${table} force row level security`,
    policy(TENANT_ISOLATION_POLICIES.select, `for select using (${read})`),
    policy(TENANT_ISOLATION_POLICIES.insert, `for insert with check (${write})`),
    policy(TENANT_ISOLATION_POLICIES.update, `for update using (${write}) with check (${write})`),
    policy(TENANT_ISOLATION_POLICIES.delete, `for delete using (${write})`),
  ];
}

function qualified({ table, schema }: TenantTableTarget): string {
  return schema === undefined ? quoted(table) : `${quoted(schema)}.${quoted(table)}`;
}

function quoted(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}
