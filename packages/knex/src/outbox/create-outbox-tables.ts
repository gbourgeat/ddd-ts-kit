import type { Knex } from 'knex';
import { INDEXABLE_LENGTH } from '../columns/indexable-length';
import { INSTANT } from '../columns/instant';
import { dialectOf } from '../sql/dialect-of';
import type { SqlDialect } from '../sql/sql-dialect';
import { builderIn } from './builder-in';
import type { OutboxTablesOptions } from './outbox-tables-options';
import { OUTBOX_TABLE, PROCESSED_EVENTS_TABLE } from './table-names';

/**
 * Creates the outbox and processed-event tables. Call it from a migration of the consuming
 * project (`export const up = (knex) => createOutboxTables(knex, { schema: 'messaging' })`),
 * which then owns the tables like any other.
 */
export async function createOutboxTables(knex: Knex, options: OutboxTablesOptions = {}): Promise<void> {
  if (options.schema !== undefined) {
    await createNamespace(knex, options.schema);
  }

  await createOutboxTable(knex, options);
  await createProcessedEventsTable(knex, options);
}

/** One namespace per bounded context: a schema in PostgreSQL, a database in MySQL. */
async function createNamespace(knex: Knex, name: string): Promise<void> {
  switch (dialectOf(knex)) {
    case 'postgres':
      await knex.schema.createSchemaIfNotExists(name);

      return;
    case 'mysql':
      await knex.raw('create database if not exists ??', [name]);

      return;
    case 'sqlite':
      throw new TypeError(
        'SQLite has no schemas: name the tables per context with outboxTable and processedEventsTable',
      );
    default:
    // Any other database: the schema is expected to exist already.
  }
}

async function createOutboxTable(knex: Knex, options: OutboxTablesOptions): Promise<void> {
  const outbox = options.outboxTable ?? OUTBOX_TABLE;

  await builderIn(knex, options.schema).createTable(outbox, (table) => {
    keyColumns(table, dialectOf(knex));
    table.text('type').notNullable();
    table.integer('version').notNullable();
    // Text, not a timestamp: the envelope must come back exactly as published, offset included.
    table.text('occurred_at').notNullable();
    table.jsonb('payload');
    table.text('traceparent');
    table.text('correlation_id');

    if (options.tenant === true) {
      table.string('tenant_id', INDEXABLE_LENGTH);
    }

    table.string('status', 16).notNullable().defaultTo('pending');
    table.integer('attempts').notNullable().defaultTo(0);
    table.datetime('next_attempt_at', INSTANT).notNullable();
    table.text('last_error_code');
    table.datetime('published_at', INSTANT);
    table.datetime('created_at', INSTANT).notNullable().defaultTo(rightNow(knex));
    pendingIndex(table, outbox, knex);
  });
}

/** The identifier and `sequence`, the insertion order that breaks the ties of the claim. */
function keyColumns(table: Knex.CreateTableBuilder, dialect: SqlDialect): void {
  switch (dialect) {
    case 'sqlite':
      // SQLite only auto-increments an integer primary key, so the roles are swapped there.
      table.increments('sequence');
      table.string('id', INDEXABLE_LENGTH).notNullable().unique();

      return;
    case 'mysql':
      table.string('id', INDEXABLE_LENGTH).primary();
      // Spelled out: knex drops AUTO_INCREMENT from a non-primary bigIncrements on MySQL,
      // which also requires such a column to be a key.
      table.specificType('sequence', 'bigint unsigned not null auto_increment unique');

      return;
    default:
      table.string('id', INDEXABLE_LENGTH).primary();
      table.bigIncrements('sequence', { primaryKey: false });
  }
}

function rightNow(knex: Knex): Knex.Raw {
  // SQLite knows CURRENT_TIMESTAMP only without a precision.
  return dialectOf(knex) === 'sqlite' ? knex.fn.now() : knex.fn.now(3);
}

function pendingIndex(table: Knex.CreateTableBuilder, outbox: string, knex: Knex): void {
  if (dialectOf(knex) === 'mysql') {
    // No partial index in MySQL: the status leads the index instead.
    table.index(['status', 'next_attempt_at', 'sequence'], `${outbox}_pending_idx`);
  } else {
    // Partial: the relay only ever scans what is pending, and published rows dominate.
    table.index(['next_attempt_at', 'sequence'], `${outbox}_pending_idx`, {
      predicate: knex.whereRaw("status = 'pending'"),
    });
  }
}

async function createProcessedEventsTable(knex: Knex, options: OutboxTablesOptions): Promise<void> {
  await builderIn(knex, options.schema).createTable(options.processedEventsTable ?? PROCESSED_EVENTS_TABLE, (table) => {
    table.string('consumer', INDEXABLE_LENGTH).notNullable();
    table.string('event_id', INDEXABLE_LENGTH).notNullable();
    table.datetime('processed_at', INSTANT).notNullable().defaultTo(rightNow(knex));
    // The primary key is the unique (consumer, event_id) the store relies on.
    table.primary(['consumer', 'event_id']);
  });
}
