import { boolean, integer, jsonb, primaryKey, text } from 'drizzle-orm/pg-core';
import { instant } from '../columns/instant';
import { tableIn } from '../schema/table-in';

export type ProcessesTable = ReturnType<typeof processesTable>;

/** The instances of the process managers of a context, to include in the schema files drizzle-kit reads. */
export function processesTable(schemaName?: string) {
  return tableIn(schemaName)(
    'process_instances',
    {
      name: text('name').notNull(),
      id: text('id').notNull(),
      state: jsonb('state'),
      version: integer('version').notNull(),
      ended: boolean('ended').notNull().default(false),
      timeouts: jsonb('timeouts').$type<Record<string, string>>().notNull(),
      updatedAt: instant('updated_at').notNull().defaultNow(),
    },
    (table) => [primaryKey({ columns: [table.name, table.id] })],
  );
}
