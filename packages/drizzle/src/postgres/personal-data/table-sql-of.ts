import { sql, type SQL } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import type { DrizzlePersonalFields } from './drizzle-personal-fields';

/** The table of a declaration, in its schema, quoted. */
export function tableSqlOf({ table }: DrizzlePersonalFields): SQL {
  const { schema, name } = getTableConfig(table);

  return schema === undefined ? sql`${sql.identifier(name)}` : sql`${sql.identifier(schema)}.${sql.identifier(name)}`;
}
