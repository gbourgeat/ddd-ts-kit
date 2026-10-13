import type { Knex } from 'knex';
import { INDEXABLE_LENGTH } from '../columns/indexable-length.js';
import { INSTANT } from '../columns/instant.js';
import { builderIn } from '../outbox/builder-in.js';
import { PROCESS_TABLE } from './process-table-name.js';
import type { ProcessTableOptions } from './process-table-options.js';

/**
 * Creates the table of the process managers' instances, on PostgreSQL, from a migration of the
 * project: one row per process and correlation key, its JSON state, its version, its end and its
 * armed timeouts.
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
    columns.primary(['name', 'id']);
  });
}
