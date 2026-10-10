import type { Knex } from 'knex';
import type { AuditTablesOptions } from '../sql/audit-tables-options.js';
import { dropAuditTablesSql } from '../sql/drop-audit-tables-sql.js';

/** The `down` of `createAuditTables`: the trail is gone with it. The schema is left in place. */
export async function dropAuditTables(knex: Knex, options: AuditTablesOptions = {}): Promise<void> {
  for (const statement of dropAuditTablesSql(options)) {
    await knex.raw(statement);
  }
}
