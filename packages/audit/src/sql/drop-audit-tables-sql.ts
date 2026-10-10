import { AUDIT_CHAINS_TABLE } from './audit-chains-table-name.js';
import { AUDIT_ENTRIES_TABLE } from './audit-entries-table-name.js';
import type { AuditTablesOptions } from './audit-tables-options.js';
import { named } from './named.js';

/** The `down` of `auditTablesSql`. The schema itself is left in place. */
export function dropAuditTablesSql(options: AuditTablesOptions = {}): string[] {
  return [
    `drop table if exists ${named(options.schema, AUDIT_ENTRIES_TABLE)}`,
    `drop table if exists ${named(options.schema, AUDIT_CHAINS_TABLE)}`,
    `drop function if exists ${named(options.schema, 'audit_entries_append_only')}()`,
  ];
}
