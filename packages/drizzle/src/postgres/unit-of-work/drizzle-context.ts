import type { ExtractTablesWithRelations, TablesRelationalConfig } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

/**
 * Gives adapters the right handle to run their queries on: the transaction of the current
 * unit of work when there is one, the database otherwise. Repositories depend on this and
 * never receive a transaction as a parameter.
 *
 * The type parameters are those of the drizzle database (driver result kind, schema), so the
 * handle is exactly as typed as `db` itself, relational queries included. A transaction is a
 * `PgDatabase`, hence the single return type.
 *
 * Generic, so it is not an injection token by itself: the project names its database with a
 * class of its own, `export abstract class Database extends DrizzleContext<NodePgQueryResultHKT> {}`.
 */
export abstract class DrizzleContext<
  Q extends PgQueryResultHKT,
  F extends Record<string, unknown> = Record<string, never>,
  S extends TablesRelationalConfig = ExtractTablesWithRelations<F>,
> {
  abstract executor(): PgDatabase<Q, F, S>;

  abstract inTransaction(): boolean;
}
