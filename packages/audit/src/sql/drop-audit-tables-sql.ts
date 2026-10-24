import { AUDIT_ARCHIVES_TABLE } from './audit-archives-table-name';
import { AUDIT_CHAINS_TABLE } from './audit-chains-table-name';
import { AUDIT_ENTRIES_TABLE } from './audit-entries-table-name';
import type { AuditTablesOptions } from './audit-tables-options';
import { named } from './named';

/** The `down` of `auditTablesSql`. The schema itself is left in place. */
export function dropAuditTablesSql(options: AuditTablesOptions = {}): string[] {
  return [
    `drop table if exists ${named(options.schema, AUDIT_ENTRIES_TABLE)}`,
    `drop table if exists ${named(options.schema, AUDIT_CHAINS_TABLE)}`,
    `drop table if exists ${named(options.schema, AUDIT_ARCHIVES_TABLE)}`,
    `drop function if exists ${named(options.schema, 'audit_entries_append_only')}()`,
    `drop function if exists ${named(options.schema, 'audit_archives_append_only')}()`,
  ];
}
