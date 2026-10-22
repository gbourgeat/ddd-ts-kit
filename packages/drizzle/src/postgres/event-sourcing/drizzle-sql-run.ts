import { sql, type ExtractTablesWithRelations, type TablesRelationalConfig } from 'drizzle-orm';
import type { PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { SqlRun } from '@ddd-ts-kit/kernel';
import { rowsOf } from '../read-model/rows-of';
import type { DrizzleContext } from '../unit-of-work/drizzle-context';

/** Runs the statements of the shared PostgreSQL stores on the executor of the context, each `$n` bound as a parameter. */
export function drizzleSqlRun<
  Q extends PgQueryResultHKT,
  F extends Record<string, unknown> = Record<string, never>,
  S extends TablesRelationalConfig = ExtractTablesWithRelations<F>,
>(context: DrizzleContext<Q, F, S>): SqlRun {
  return async (statement, parameters) => {
    const pieces = statement.split(/\$\d+/);

    const query = sql.join(
      pieces.flatMap((piece, index) =>
        index < parameters.length ? [sql.raw(piece), sql`${parameters[index]}`] : [sql.raw(piece)],
      ),
      sql.raw(''),
    );

    return rowsOf(await context.executor().execute(query));
  };
}
