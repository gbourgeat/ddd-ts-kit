import type { TablesRelationalConfig } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

/** The `DrizzleContext` of `@ddd-ts-kit/drizzle`, restated structurally: any unit of work of that package fits. */
export interface DrizzleAuditContext<
  Q extends PgQueryResultHKT,
  F extends Record<string, unknown>,
  S extends TablesRelationalConfig,
> {
  executor(): PgDatabase<Q, F, S>;
}
