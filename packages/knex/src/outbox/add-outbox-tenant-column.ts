import type { Knex } from 'knex';
import { builderIn } from './builder-in.js';
import type { OutboxTablesOptions } from './outbox-tables-options.js';
import { INDEXABLE_LENGTH } from '../columns/indexable-length.js';
import { OUTBOX_TABLE } from './table-names.js';

/**
 * Adds `tenant_id` to an outbox created without it: the migration of a project that becomes
 * multi-tenant (`export const up = (knex) => addOutboxTenantColumn(knex, { schema: 'messaging' })`).
 * Nullable: the events already in it belong to no tenant.
 */
export async function addOutboxTenantColumn(knex: Knex, options: OutboxTablesOptions = {}): Promise<void> {
  await builderIn(knex, options.schema).alterTable(options.outboxTable ?? OUTBOX_TABLE, (table) => {
    table.string('tenant_id', INDEXABLE_LENGTH);
  });
}
