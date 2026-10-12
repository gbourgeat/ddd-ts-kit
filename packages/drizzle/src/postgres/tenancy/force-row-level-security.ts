import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';

/**
 * The statement drizzle-kit does not write: row-level security forced on the owner of the table
 * too. For a custom migration (`drizzle-kit generate --custom`) after the one that created the
 * table and its `tenantPolicy`.
 */
export function forceRowLevelSecurity(table: PgTable): string {
  const { schema, name } = getTableConfig(table);
  const qualified = schema === undefined ? `"${name}"` : `"${schema}"."${name}"`;

  return `alter table ${qualified} force row level security;`;
}
