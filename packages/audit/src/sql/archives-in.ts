import type { AuditArchive } from '../archive/audit-archive';
import type { AuditTables } from './audit-tables';
import type { SqlRow } from './sql-row';
import type { SqlSession } from './sql-session';
import { sql } from './sql';

/** The archives of a chain, oldest first. */
export async function archivesIn(session: SqlSession, tables: AuditTables, chain: string): Promise<AuditArchive[]> {
  const rows = await session.query(
    sql`select *, to_char("archived_at" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "archived_at_utc" from ${tables.archives} where "chain" = ${chain} order by "to_sequence"`,
  );

  return rows.map(archiveOfRow);
}

function archiveOfRow(row: SqlRow): AuditArchive {
  return {
    chain: String(row['chain']),
    fromSequence: Number(row['from_sequence']),
    toSequence: Number(row['to_sequence']),
    lastHash: String(row['last_hash']),
    entries: Number(row['entries']),
    fileKey: String(row['file_key']),
    fileDigest: String(row['file_digest']),
    archivedAt: new Date(String(row['archived_at_utc'])),
  };
}
