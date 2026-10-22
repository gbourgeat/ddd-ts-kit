import { AUDIT_CHAINS_TABLE } from './audit-chains-table-name';
import { AUDIT_ENTRIES_TABLE } from './audit-entries-table-name';
import type { AuditTablesOptions } from './audit-tables-options';
import { qualified } from './qualified';
import type { Sql } from './sql';

export interface AuditTables {
  readonly entries: Sql;
  readonly chains: Sql;
}

export function auditTables({ schema }: AuditTablesOptions = {}): AuditTables {
  return { entries: qualified(schema, AUDIT_ENTRIES_TABLE), chains: qualified(schema, AUDIT_CHAINS_TABLE) };
}
