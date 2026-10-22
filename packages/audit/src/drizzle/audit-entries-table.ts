import type { AuditChanges } from '@ddd-ts-kit/kernel';
import { bigint, index, jsonb, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import { AUDIT_ENTRIES_TABLE } from '../sql/audit-entries-table-name';
import { tableIn } from './table-in';

const ENTRY_COLUMNS = {
  id: text('id').notNull().unique(),
  chain: text('chain').notNull(),
  sequence: bigint('sequence', { mode: 'number' }).notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date', precision: 3 }).notNull(),
  category: text('category').notNull(),
  action: text('action').notNull(),
  outcome: text('outcome').notNull(),
  reason: text('reason'),
  actorId: text('actor_id').notNull(),
  actorType: text('actor_type').notNull(),
  actorTenantId: text('actor_tenant_id'),
  tenantId: text('tenant_id'),
  impersonatedBy: text('impersonated_by'),
  sessionId: text('session_id'),
  resourceType: text('resource_type'),
  resourceId: text('resource_id'),
  context: text('context'),
  correlationId: text('correlation_id').notNull(),
  causationId: text('causation_id'),
  origin: text('origin').notNull(),
  changes: jsonb('changes').$type<AuditChanges>(),
  extensions: jsonb('extensions').notNull().default({}),
  previousHash: text('previous_hash').notNull(),
  hash: text('hash').notNull(),
};

export type AuditEntriesTable = ReturnType<typeof auditEntriesTable>;

/**
 * The entries table, to include in the schema files drizzle-kit reads so that the migrations
 * of the consuming project create it. Without a schema name it lives in `public`. Add
 * `auditChainsTable` next to it and `auditGuardStatements` in a custom migration.
 */
export function auditEntriesTable(schemaName?: string) {
  return tableIn(schemaName)(AUDIT_ENTRIES_TABLE, ENTRY_COLUMNS, (table) => [
    primaryKey({ columns: [table.chain, table.sequence] }),
    index('audit_entries_occurred_idx').on(table.occurredAt, table.chain, table.sequence),
    index('audit_entries_actor_idx').on(table.actorId, table.occurredAt),
    index('audit_entries_resource_idx').on(table.resourceType, table.resourceId),
    index('audit_entries_correlation_idx').on(table.correlationId),
  ]);
}
