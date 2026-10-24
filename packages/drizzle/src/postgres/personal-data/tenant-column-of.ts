import type { PgColumn } from 'drizzle-orm/pg-core';
import { getTableConfig } from 'drizzle-orm/pg-core';
import type { DrizzlePersonalFields } from './drizzle-personal-fields';

/** The column of a table that names its tenant, by its SQL name. */
export function tenantColumnOf(
  columns: Readonly<Record<string, PgColumn>>,
  name: string,
  declaration: DrizzlePersonalFields,
): PgColumn {
  const column = Object.values(columns).find((candidate) => candidate.name === name);

  if (column === undefined) {
    throw new Error(
      `The table ${getTableConfig(declaration.table).name} has no column "${name}": a table of tenant data names its tenant in it, or the erasure is given the column`,
    );
  }

  return column;
}
