import { PostgresReadModelTables, type ReadModelTablesOptions } from '@ddd-ts-kit/kernel';
import { knexSqlRun } from '../event-sourcing/knex-sql-run';
import type { KnexContext } from '../unit-of-work/knex-context';

/**
 * The read model tables of the database, on PostgreSQL, checked in one pass through knex: what an
 * application asks at its start, whatever builds its stores and whenever, and what a script asks
 * of the database of a deployment before it. Each table can hold the trace of a deleted row, or
 * is named with its columns and the migration to write.
 */
export function knexReadModelTables(
  context: KnexContext,
  options: ReadModelTablesOptions = {},
): PostgresReadModelTables {
  return new PostgresReadModelTables(knexSqlRun(context), options);
}
