import { bigint, text } from 'drizzle-orm/pg-core';
import { AUDIT_CHAINS_TABLE } from '../sql/audit-chains-table-name.js';
import { tableIn } from './table-in.js';

export type AuditChainsTable = ReturnType<typeof auditChainsTable>;

/** The head of each chain: the row an append locks. One row per chain, updated in place. */
export function auditChainsTable(schemaName?: string) {
  return tableIn(schemaName)(AUDIT_CHAINS_TABLE, {
    chain: text('chain').primaryKey(),
    sequence: bigint('sequence', { mode: 'number' }).notNull(),
    hash: text('hash').notNull(),
  });
}
