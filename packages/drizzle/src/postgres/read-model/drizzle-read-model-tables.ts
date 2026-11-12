import type { ExtractTablesWithRelations, TablesRelationalConfig } from 'drizzle-orm';
import type { PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { PostgresReadModelTables, type ReadModelTablesOptions } from '@ddd-ts-kit/kernel';
import { drizzleSqlRun } from '../event-sourcing/drizzle-sql-run';
import type { DrizzleContext } from '../unit-of-work/drizzle-context';

/**
 * The read model tables of the database, checked in one pass through drizzle: what an
 * application asks at its start, whatever builds its stores and whenever, and what a script asks
 * of the database of a deployment before it. Each table can hold the trace of a deleted row, or
 * is named with its columns and the migration to write.
 */
export function drizzleReadModelTables<
  Q extends PgQueryResultHKT,
  F extends Record<string, unknown> = Record<string, never>,
  S extends TablesRelationalConfig = ExtractTablesWithRelations<F>,
>(context: DrizzleContext<Q, F, S>, options: ReadModelTablesOptions = {}): PostgresReadModelTables {
  return new PostgresReadModelTables(drizzleSqlRun(context), options);
}
