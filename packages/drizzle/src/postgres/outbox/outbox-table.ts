import { sql } from 'drizzle-orm';
import { index } from 'drizzle-orm/pg-core';
import { tableIn } from '../schema/table-in.js';
import { outboxColumns } from './outbox-columns.js';

export type OutboxTable = ReturnType<typeof outboxTable>;

/**
 * The outbox table, to include in the schema files drizzle-kit reads so that it is created by
 * the migrations of the consuming project. Without a schema name it lives in `public`.
 */
export function outboxTable(schemaName?: string) {
  return tableIn(schemaName)('outbox', outboxColumns(), (table) => [
    // Partial: the relay only ever scans what is pending, and published rows dominate.
    index('outbox_pending_idx').on(table.nextAttemptAt, table.sequence).where(sql`${table.status} = 'pending'`),
  ]);
}
