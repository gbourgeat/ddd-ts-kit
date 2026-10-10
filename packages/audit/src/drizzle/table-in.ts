import { pgSchema, pgTable, type PgTableFn } from 'drizzle-orm/pg-core';

/** The table constructor of a schema, or the one of `public` without a name. */
export function tableIn(schemaName: string | undefined): PgTableFn<string | undefined> {
  return schemaName === undefined ? pgTable : pgSchema(schemaName).table;
}
