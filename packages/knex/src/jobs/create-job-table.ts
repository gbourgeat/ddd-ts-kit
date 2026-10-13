import type { Knex } from 'knex';
import { INDEXABLE_LENGTH } from '../columns/indexable-length.js';
import { INSTANT } from '../columns/instant.js';
import { builderIn } from '../outbox/builder-in.js';
import { JOB_TABLE } from './job-table-name.js';
import type { JobTableOptions } from './job-table-options.js';

/**
 * Creates the table of the background jobs, on PostgreSQL. Call it from a migration of the
 * project (`export const up = (knex) => createJobTable(knex, { schema: 'scheduling' })`), which
 * then owns the table like any other. In the schema of a context, the jobs of that context
 * travel with it when it is extracted as a service.
 */
export async function createJobTable(knex: Knex, options: JobTableOptions = {}): Promise<void> {
  const table = options.table ?? JOB_TABLE;

  if (options.schema !== undefined) {
    await knex.schema.createSchemaIfNotExists(options.schema);
  }

  await builderIn(knex, options.schema).createTable(table, (columns) => {
    columns.string('id', INDEXABLE_LENGTH).primary();
    columns.bigIncrements('sequence', { primaryKey: false });
    columns.string('name', INDEXABLE_LENGTH).notNullable();
    columns.string('queue', INDEXABLE_LENGTH).notNullable();
    columns.jsonb('payload');
    columns.jsonb('enqueued_by').notNullable();
    columns.string('idempotency_key', INDEXABLE_LENGTH);
    // The empty text outside any tenant: a null would make every such key distinct.
    columns.string('tenant_id', INDEXABLE_LENGTH).notNullable().defaultTo('');
    columns.string('subject', INDEXABLE_LENGTH);
    columns.string('status', 16).notNullable().defaultTo('waiting');
    columns.integer('attempts').notNullable().defaultTo(0);
    columns.datetime('run_at', INSTANT).notNullable();
    columns.datetime('lease_until', INSTANT);
    columns.jsonb('progress');
    columns.jsonb('checkpoint');
    columns.text('last_error_code');
    columns.datetime('enqueued_at', INSTANT).notNullable();
    columns.datetime('finished_at', INSTANT);
    columns.unique(['name', 'tenant_id', 'idempotency_key'], { indexName: `${table}_idempotency_key` });

    // Partial: a claim only ever looks at what is waiting or running, and finished jobs dominate.
    columns.index(['queue', 'run_at', 'sequence'], `${table}_due_idx`, {
      predicate: knex.whereRaw("status in ('waiting', 'running')"),
    });
  });
}
