import { pgSchema, pgTable, type PgTableFn } from 'drizzle-orm/pg-core';

export function tableIn(schemaName: string | undefined): PgTableFn<string | undefined> {
  return schemaName === undefined ? pgTable : pgSchema(schemaName).table;
}
