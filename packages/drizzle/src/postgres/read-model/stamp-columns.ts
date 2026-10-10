import { getTableColumns } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';

export interface StampColumns {
  readonly lastEventId: PgColumn;
  readonly lastEventAt: PgColumn;
  readonly lastEventVersion: PgColumn;
  readonly deleted: PgColumn;
}

/** The columns `readModelColumns()` gave a table. A table declared without them is refused. */
export function stampColumns(table: PgTable): StampColumns {
  const columns: Readonly<Record<string, PgColumn>> = getTableColumns(table);
  const { lastEventId, lastEventAt, lastEventVersion, deleted } = columns;

  if (
    lastEventId === undefined ||
    lastEventAt === undefined ||
    lastEventVersion === undefined ||
    deleted === undefined
  ) {
    throw new Error('The table of a read model is declared with ...readModelColumns()');
  }

  return { lastEventId, lastEventAt, lastEventVersion, deleted };
}
