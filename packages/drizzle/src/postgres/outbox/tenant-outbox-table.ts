import { sql } from 'drizzle-orm';
import { index, text } from 'drizzle-orm/pg-core';
import { tableIn } from '../schema/table-in';
import { outboxColumns } from './outbox-columns';

/**
 * The outbox of a multi-tenant project: `outboxTable` and `tenant_id`, nullable, which
 * `DrizzleOutboxStore` fills from the tenant of each event so that its consumers run in that
 * tenant. A project that becomes multi-tenant swaps it in and generates the migration that adds
 * the column.
 */
export function tenantOutboxTable(schemaName?: string) {
  return tableIn(schemaName)('outbox', { ...outboxColumns(), tenantId: text('tenant_id') }, (table) => [
    index('outbox_pending_idx').on(table.nextAttemptAt, table.sequence).where(sql`${table.status} = 'pending'`),
  ]);
}
