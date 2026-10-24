import { auditArchiveUpgradeSql } from './audit-archive-upgrade-sql';

/**
 * What a trail created before the archives runs once, in a migration of its own: the archives
 * table if the ORM did not create it, the functions of the guard replaced so that an archived entry
 * may be deleted, and the guard of the archives.
 */
export function auditArchiveUpgradeStatements(schemaName?: string): string[] {
  return auditArchiveUpgradeSql(schemaName === undefined ? {} : { schema: schemaName });
}
