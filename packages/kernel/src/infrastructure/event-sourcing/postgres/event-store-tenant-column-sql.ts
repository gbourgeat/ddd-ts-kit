import type { EventStoreTablesOptions } from './event-store-tables-options';
import { qualifiedTable } from './qualified-table';

/**
 * The statement that adds `tenant_id` to the events of an event store created without it: the
 * migration of a project that becomes multi-tenant. The streams already stored keep no tenant, and a
 * store given an execution scope then refuses them to every tenant: give each one its own with an
 * `update` of `tenant_id` in the same migration.
 */
export function eventStoreTenantColumnSql(options: EventStoreTablesOptions = {}): string {
  return `alter table ${qualifiedTable(options.schema, 'events')} add column if not exists tenant_id text`;
}
