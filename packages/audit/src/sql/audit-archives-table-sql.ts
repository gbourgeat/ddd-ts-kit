import { AUDIT_ARCHIVES_TABLE } from './audit-archives-table-name';
import type { AuditTablesOptions } from './audit-tables-options';
import { named } from './named';

/**
 * The archives of the trail: one row per range of a chain written to the file storage and removed
 * from the entries, with the hash of its last entry (the anchor the chain goes on from), the key
 * and the digest of its file. Append-only like the entries, and what the guard reads to let the
 * archived entries, and them alone, be deleted.
 */
export function auditArchivesTableSql(options: AuditTablesOptions = {}, ifNotExists = false): string {
  return `create table ${ifNotExists ? 'if not exists ' : ''}${named(options.schema, AUDIT_ARCHIVES_TABLE)} ("chain" text not null, "from_sequence" bigint not null, "to_sequence" bigint not null, "last_hash" text not null, "entries" integer not null, "file_key" text not null, "file_digest" text not null, "archived_at" timestamptz(3) not null, primary key ("chain", "to_sequence"))`;
}
