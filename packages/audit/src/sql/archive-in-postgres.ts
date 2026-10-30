import { archivablePrefix } from '../archive/archivable-prefix';
import { archiveEach } from '../archive/archive-each';
import type { ArchiveOptions } from '../archive/archive-options';
import { archiveOf } from '../archive/archive-of';
import type { AuditArchive } from '../archive/audit-archive';
import type { AuditArchiveReport } from '../archive/audit-archive-report';
import type { AuditTables } from './audit-tables';
import { entryOf } from './entry-of';
import { archivesIn } from './archives-in';
import type { SqlSession } from './sql-session';
import { sql } from './sql';

const OCCURRED_AT_UTC = sql`to_char("occurred_at" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

/**
 * Archives every chain, one transaction each, in the order of their names: the head of the chain
 * is locked first, so no entry is appended to the range while it is written and removed. A chain
 * that does not verify rolls back its own transaction alone.
 */
export async function archiveInPostgres(
  session: SqlSession,
  tables: AuditTables,
  { before, options }: { readonly before: Date; readonly options: ArchiveOptions },
): Promise<AuditArchiveReport> {
  const chains = await session.query(sql`select "chain" from ${tables.chains} order by "chain"`);

  return archiveEach(
    chains.map((row) => String(row['chain'])),
    (chain) => session.transaction((transaction) => archiveChain(transaction, tables, { chain, before, options })),
  );
}

interface ChainToArchive {
  readonly chain: string;
  readonly before: Date;
  readonly options: ArchiveOptions;
}

async function archiveChain(
  transaction: SqlSession,
  tables: AuditTables,
  { chain, before, options }: ChainToArchive,
): Promise<AuditArchive | undefined> {
  await transaction.query(sql`select 1 from ${tables.chains} where "chain" = ${chain} for update`);

  const previous = (await archivesIn(transaction, tables, chain)).at(-1);
  const after = previous?.toSequence ?? 0;

  const rows = await transaction.query(
    sql`select *, ${OCCURRED_AT_UTC} as "occurred_at_utc" from ${tables.entries} where "chain" = ${chain} and "sequence" > ${after} and "occurred_at" < ${before.toISOString()}::timestamptz order by "sequence"`,
  );

  const archive = await archiveOf(chain, archivablePrefix(rows.map(entryOf), after + 1, before), { previous, options });

  if (archive !== undefined) {
    await transaction.query(
      sql`insert into ${tables.archives} ("chain", "from_sequence", "to_sequence", "last_hash", "entries", "file_key", "file_digest", "archived_at") values (${chain}, ${archive.fromSequence}, ${archive.toSequence}, ${archive.lastHash}, ${archive.entries}, ${archive.fileKey}, ${archive.fileDigest}, ${archive.archivedAt.toISOString()}::timestamptz)`,
    );

    // Allowed by the guard: the archive just recorded covers them.
    await transaction.query(
      sql`delete from ${tables.entries} where "chain" = ${chain} and "sequence" <= ${archive.toSequence}`,
    );
  }

  return archive;
}
