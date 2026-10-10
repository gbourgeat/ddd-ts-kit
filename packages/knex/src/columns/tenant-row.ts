import type { TenantScoped } from '@ddd-ts-kit/kernel';

export interface TenantRow {
  tenant_id: string;
}

/** `tenantScopeOf(scope)` under the column name: spread it into an insert and into every `where`. */
export function tenantRow(scoped: TenantScoped): TenantRow {
  return { tenant_id: scoped.tenantId };
}
