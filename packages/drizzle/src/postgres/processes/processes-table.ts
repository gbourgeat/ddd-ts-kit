import { boolean, integer, jsonb, primaryKey, text } from 'drizzle-orm/pg-core';
import { instant } from '../columns/instant';
import { tableIn } from '../schema/table-in';

export type ProcessesTable = ReturnType<typeof processesTable>;

/**
 * The instances of the process managers of a context, to include in the schema files drizzle-kit
 * reads: one row per tenant, process and correlation key, the tenant empty outside any tenant.
 */
export function processesTable(schemaName?: string) {
  return tableIn(schemaName)(
    'process_instances',
    {
      /** The empty text outside any tenant: a null could not be part of the primary key. */
      tenantId: text('tenant_id').notNull().default(''),
      name: text('name').notNull(),
      id: text('id').notNull(),
      state: jsonb('state'),
      version: integer('version').notNull(),
      ended: boolean('ended').notNull().default(false),
      timeouts: jsonb('timeouts').$type<Record<string, string>>().notNull(),
      updatedAt: instant('updated_at').notNull().defaultNow(),
    },
    (table) => [primaryKey({ columns: [table.tenantId, table.name, table.id] })],
  );
}
