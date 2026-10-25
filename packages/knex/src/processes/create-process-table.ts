import type { Knex } from 'knex';
import { INDEXABLE_LENGTH } from '../columns/indexable-length';
import { INSTANT } from '../columns/instant';
import { builderIn } from '../outbox/builder-in';
import { PROCESS_TABLE } from './process-table-name';
import type { ProcessTableOptions } from './process-table-options';

/**
 * Creates the table of the process managers' instances, on PostgreSQL, from a migration of the
 * project: one row per tenant, process and correlation key, its JSON state, its version, its end
 * and its armed timeouts. Two tenants may use the same key, each for an instance of its own.
 */
export async function createProcessTable(knex: Knex, options: ProcessTableOptions = {}): Promise<void> {
  if (options.schema !== undefined) {
    await knex.schema.createSchemaIfNotExists(options.schema);
  }

  await builderIn(knex, options.schema).createTable(options.table ?? PROCESS_TABLE, (columns) => {
    // The empty text outside any tenant: a null could not be part of the primary key.
    columns.string('tenant_id', INDEXABLE_LENGTH).notNullable().defaultTo('');
    columns.string('name', INDEXABLE_LENGTH).notNullable();
    columns.string('id', INDEXABLE_LENGTH).notNullable();
    columns.jsonb('state');
    columns.integer('version').notNullable();
    columns.boolean('ended').notNullable().defaultTo(false);
    columns.jsonb('timeouts').notNullable();
    columns.datetime('updated_at', INSTANT).notNullable().defaultTo(knex.fn.now(3));
    columns.primary(['tenant_id', 'name', 'id']);
  });
}
