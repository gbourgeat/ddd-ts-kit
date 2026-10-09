import { AsyncLocalStorage } from 'node:async_hooks';
import type { ExtractTablesWithRelations, TablesRelationalConfig } from 'drizzle-orm';
import type {
  PgDatabase,
  PgQueryResultHKT,
  PgTransaction,
  PgTransactionConfig,
} from 'drizzle-orm/pg-core';
import type { UnitOfWork } from '@ddd-ts-kit/kernel';

/**
 * Gives adapters the right handle to run their queries on: the transaction of the current
 * unit of work when there is one, the database otherwise. Repositories depend on this and
 * never receive a transaction as a parameter.
 *
 * The type parameters are those of the drizzle database (driver result kind, schema), so the
 * handle is exactly as typed as `db` itself, relational queries included. A transaction is a
 * `PgDatabase`, hence the single return type.
 */
export interface DrizzleContext<
  Q extends PgQueryResultHKT,
  F extends Record<string, unknown> = Record<string, never>,
  S extends TablesRelationalConfig = ExtractTablesWithRelations<F>,
> {
  executor(): PgDatabase<Q, F, S>;
  inTransaction(): boolean;
}

export interface DrizzleUnitOfWork<
  Q extends PgQueryResultHKT,
  F extends Record<string, unknown> = Record<string, never>,
  S extends TablesRelationalConfig = ExtractTablesWithRelations<F>,
> extends UnitOfWork,
    DrizzleContext<Q, F, S> {}

/**
 * A unit of work over `db.transaction`, for any drizzle PostgreSQL driver (node-postgres,
 * postgres-js, PGlite, Neon...). The transaction travels in an AsyncLocalStorage owned by this
 * unit of work, so two databases never see each other's transaction. A nested `run` joins the
 * outer transaction: it commits or rolls back as a whole.
 */
export function createDrizzleUnitOfWork<
  Q extends PgQueryResultHKT,
  F extends Record<string, unknown>,
  S extends TablesRelationalConfig,
>(db: PgDatabase<Q, F, S>, config?: PgTransactionConfig): DrizzleUnitOfWork<Q, F, S> {
  const current = new AsyncLocalStorage<PgTransaction<Q, F, S>>();
  return {
    run<T>(work: () => Promise<T>): Promise<T> {
      if (current.getStore() !== undefined) {
        return work();
      }
      return db.transaction((transaction) => current.run(transaction, work), config);
    },
    executor: () => current.getStore() ?? db,
    inTransaction: () => current.getStore() !== undefined,
  };
}
