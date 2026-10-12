/**
 * The names of the row-level security policies of a table of tenant data, in every adapter: one
 * per command, because PostgreSQL applies the `using` of a single policy to the rows a `delete`
 * or an `update` targets. Reads see the reach of the work; inserts, updates and deletes only ever
 * touch the rows of its one tenant, elevated or not.
 */
export const TENANT_ISOLATION_POLICIES = {
  select: 'tenant_isolation_select',
  insert: 'tenant_isolation_insert',
  update: 'tenant_isolation_update',
  delete: 'tenant_isolation_delete',
} as const;
