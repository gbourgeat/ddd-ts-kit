import type { Knex } from 'knex';
import { auditArchiveUpgradeSql } from '../sql/audit-archive-upgrade-sql';
import type { AuditTablesOptions } from '../sql/audit-tables-options';

/** For a trail created by an earlier `createAuditTables`, in a migration: the archives and the guard that lets archived entries go. */
export async function addAuditArchives(knex: Knex, options: AuditTablesOptions = {}): Promise<void> {
  for (const statement of auditArchiveUpgradeSql(options)) {
    await knex.raw(statement);
  }
}
