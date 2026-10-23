import type { Knex } from 'knex';
import { INDEXABLE_LENGTH } from '../columns/indexable-length';
import { INSTANT } from '../columns/instant';
import { tenantColumn } from '../columns/tenant-column';
import { builderIn } from '../outbox/builder-in';
import { PROCESS_TABLE } from './process-table-name';
import type { ProcessTableOptions } from './process-table-options';

/**
 * Creates the table of the process managers' instances, on PostgreSQL, from a migration of the
 * project: one row per process and correlation key, its JSON state, its version, its end and its
 * armed timeouts, and with `tenant` the tenant of the work that started it.
 */
export async function createProcessTable(knex: Knex, options: ProcessTableOptions = {}): Promise<void> {
  if (options.schema !== undefined) {
    await knex.schema.createSchemaIfNotExists(options.schema);
  }

  await builderIn(knex, options.schema).createTable(options.table ?? PROCESS_TABLE, (columns) => {
    columns.string('name', INDEXABLE_LENGTH).notNullable();
    columns.string('id', INDEXABLE_LENGTH).notNullable();
    columns.jsonb('state');
    columns.integer('version').notNullable();
    columns.boolean('ended').notNullable().defaultTo(false);
    columns.jsonb('timeouts').notNullable();
    columns.datetime('updated_at', INSTANT).notNullable().defaultTo(knex.fn.now(3));

    if (options.tenant === true) {
      tenantColumn(columns);
    }

    columns.primary(['name', 'id']);
  });
}
