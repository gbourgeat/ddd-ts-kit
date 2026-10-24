import { bigint, integer, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import { AUDIT_ARCHIVES_TABLE } from '../sql/audit-archives-table-name';
import { tableIn } from './table-in';

export type AuditArchivesTable = ReturnType<typeof auditArchivesTable>;

/** The archives of the trail: one row per range of a chain written to the file storage, append-only, read by the guard. */
export function auditArchivesTable(schemaName?: string) {
  return tableIn(schemaName)(
    AUDIT_ARCHIVES_TABLE,
    {
      chain: text('chain').notNull(),
      fromSequence: bigint('from_sequence', { mode: 'number' }).notNull(),
      toSequence: bigint('to_sequence', { mode: 'number' }).notNull(),
      lastHash: text('last_hash').notNull(),
      entries: integer('entries').notNull(),
      fileKey: text('file_key').notNull(),
      fileDigest: text('file_digest').notNull(),
      archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'date', precision: 3 }).notNull(),
    },
    (table) => [primaryKey({ columns: [table.chain, table.toSequence] })],
  );
}
