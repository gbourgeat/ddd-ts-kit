import { AUDIT_CHAINS_TABLE } from './audit-chains-table-name.js';
import { AUDIT_ENTRIES_TABLE } from './audit-entries-table-name.js';
import type { AuditTablesOptions } from './audit-tables-options.js';
import { qualified } from './qualified.js';
import type { Sql } from './sql.js';

export interface AuditTables {
  readonly entries: Sql;
  readonly chains: Sql;
}

export function auditTables({ schema }: AuditTablesOptions = {}): AuditTables {
  return { entries: qualified(schema, AUDIT_ENTRIES_TABLE), chains: qualified(schema, AUDIT_CHAINS_TABLE) };
}
