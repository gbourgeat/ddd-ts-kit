import type { ExtractTablesWithRelations, TablesRelationalConfig } from 'drizzle-orm';
import type { PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { postgresEventSourcing, type EventSourcingStores, type EventStoreTablesOptions } from '@ddd-ts-kit/kernel';
import type { DrizzleContext } from '../unit-of-work/drizzle-context';
import { drizzleSqlRun } from './drizzle-sql-run';

/**
 * The event store, the snapshots, the checkpoints and the keys of the data subjects on
 * PostgreSQL, through drizzle, over the tables of `eventStoreTables`. Every statement runs on
 * the executor of the context, so an append joins the transaction of the unit of work, with the
 * outbox. Bind each one to its port.
 */
export function createDrizzleEventSourcing<
  Q extends PgQueryResultHKT,
  F extends Record<string, unknown> = Record<string, never>,
  S extends TablesRelationalConfig = ExtractTablesWithRelations<F>,
>(context: DrizzleContext<Q, F, S>, options: EventStoreTablesOptions = {}): EventSourcingStores {
  return postgresEventSourcing(drizzleSqlRun(context), options);
}
