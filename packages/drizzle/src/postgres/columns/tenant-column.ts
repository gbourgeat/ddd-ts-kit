import { text } from 'drizzle-orm/pg-core';

/** The tenant column, `tenant_id`, under the key of the kernel `TenantScoped`. */
export function tenantColumn() {
  return { tenantId: text('tenant_id').notNull() };
}
