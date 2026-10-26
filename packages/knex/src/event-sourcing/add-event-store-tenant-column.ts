import type { Knex } from 'knex';
import {
  assertTenantId,
  EVENT_STORE_TABLES,
  eventStoreTenantColumnSql,
  type EventStoreTablesOptions,
} from '@ddd-ts-kit/kernel';

export interface AddEventStoreTenantColumnOptions extends EventStoreTablesOptions {
  /**
   * The tenant of the streams already stored: the one the database served. Left out, they keep no
   * tenant, and an event store given an execution scope refuses them to every tenant.
   */
  readonly tenantOfExistingStreams?: string;
}

/**
 * Adds `tenant_id` to the events of an event store created without it: the migration of a project
 * that becomes multi-tenant (`export const up = (knex) => addEventStoreTenantColumn(knex, { schema:
 * 'scheduling', tenantOfExistingStreams: 'acme' })`). Nullable, and safe to run again.
 */
export async function addEventStoreTenantColumn(
  knex: Knex,
  options: AddEventStoreTenantColumnOptions = {},
): Promise<void> {
  const tenantId =
    options.tenantOfExistingStreams === undefined ? undefined : assertTenantId(options.tenantOfExistingStreams);

  await knex.raw(eventStoreTenantColumnSql(options));

  if (tenantId === undefined) {
    return;
  }

  const events = knex(EVENT_STORE_TABLES.events);

  await (options.schema === undefined ? events : events.withSchema(options.schema))
    .whereNull('tenant_id')
    .update({ tenant_id: tenantId });
}
