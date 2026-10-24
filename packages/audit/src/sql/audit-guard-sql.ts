import { AUDIT_ARCHIVES_TABLE } from './audit-archives-table-name';
import { AUDIT_ENTRIES_TABLE } from './audit-entries-table-name';
import { auditGuardFunctionsSql } from './audit-guard-functions-sql';
import type { AuditTablesOptions } from './audit-tables-options';
import { named } from './named';

/**
 * The guard of the trail: triggers that refuse UPDATE, DELETE and TRUNCATE on `audit_entries`
 * and on `audit_archives`, whoever asks, but the DELETE of an entry an archive covers, which
 * `archiveBefore` writes in the same transaction before it removes the entries. A role that owns
 * the tables can still drop the triggers: see the README for the privileges to revoke and for
 * anchoring.
 */
export function auditGuardSql(options: AuditTablesOptions = {}): string[] {
  const entries = named(options.schema, AUDIT_ENTRIES_TABLE);
  const archives = named(options.schema, AUDIT_ARCHIVES_TABLE);
  const archivesGuard = named(options.schema, 'audit_archives_append_only');
  const guard = named(options.schema, 'audit_entries_append_only');

  return [
    ...auditGuardFunctionsSql(options),
    `create trigger "audit_entries_no_rewrite" before update or delete on ${entries} for each row execute function ${guard}()`,
    `create trigger "audit_entries_no_truncate" before truncate on ${entries} for each statement execute function ${guard}()`,
    `create trigger "audit_archives_no_rewrite" before update or delete on ${archives} for each row execute function ${archivesGuard}()`,
    `create trigger "audit_archives_no_truncate" before truncate on ${archives} for each statement execute function ${archivesGuard}()`,
  ];
}
