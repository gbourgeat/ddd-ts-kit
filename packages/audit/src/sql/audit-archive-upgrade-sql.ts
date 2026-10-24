import { AUDIT_ARCHIVES_TABLE } from './audit-archives-table-name';
import { auditArchivesTableSql } from './audit-archives-table-sql';
import { auditGuardFunctionsSql } from './audit-guard-functions-sql';
import type { AuditTablesOptions } from './audit-tables-options';
import { named } from './named';

/**
 * What a trail created before the archives runs once, in a migration: the archives table, the
 * functions of the guard replaced so that an archived entry may be deleted, and the guard of the
 * archives themselves. Safe on a trail that has them already, but for the two triggers, which a
 * second run refuses.
 */
export function auditArchiveUpgradeSql(options: AuditTablesOptions = {}): string[] {
  const archives = named(options.schema, AUDIT_ARCHIVES_TABLE);
  const archivesGuard = named(options.schema, 'audit_archives_append_only');

  return [
    auditArchivesTableSql(options, true),
    ...auditGuardFunctionsSql(options),
    `create trigger "audit_archives_no_rewrite" before update or delete on ${archives} for each row execute function ${archivesGuard}()`,
    `create trigger "audit_archives_no_truncate" before truncate on ${archives} for each statement execute function ${archivesGuard}()`,
  ];
}
