import type { Knex } from 'knex';
import type { AuditTablesOptions } from '../sql/audit-tables-options';
import { auditTablesSql } from '../sql/audit-tables-sql';

/**
 * Creates the tables of the trail and the triggers that keep `audit_entries` append-only.
 * Call it from a migration of the consuming project, which then owns the tables:
 * `export const up = (knex) => createAuditTables(knex, { schema: 'audit' })`.
 */
export async function createAuditTables(knex: Knex, options: AuditTablesOptions = {}): Promise<void> {
  for (const statement of auditTablesSql(options)) {
    await knex.raw(statement);
  }
}
