import { AUDIT_ENTRIES_TABLE } from './audit-entries-table-name';
import type { AuditTablesOptions } from './audit-tables-options';
import { named } from './named';

/**
 * The guard of `audit_entries`: triggers that refuse UPDATE, DELETE and TRUNCATE, whoever
 * asks. A role that owns the table can still drop them: see the README for the privileges to
 * revoke and for anchoring.
 */
export function auditGuardSql(options: AuditTablesOptions = {}): string[] {
  const entries = named(options.schema, AUDIT_ENTRIES_TABLE);
  const guard = named(options.schema, 'audit_entries_append_only');

  return [
    `create function ${guard}() returns trigger language plpgsql as $guard$ begin raise exception 'audit entries are append-only: % refused', tg_op using errcode = 'restrict_violation'; end $guard$`,
    `create trigger "audit_entries_no_rewrite" before update or delete on ${entries} for each row execute function ${guard}()`,
    `create trigger "audit_entries_no_truncate" before truncate on ${entries} for each statement execute function ${guard}()`,
  ];
}
