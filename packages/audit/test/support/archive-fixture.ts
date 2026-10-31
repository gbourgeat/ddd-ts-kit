import { FixedClock, type AuditTrail } from '@ddd-ts-kit/kernel';
import type { ArchivableAuditTrail, AuditArchive } from '../../src';
import type { AuditTrailUnderContract } from '../../src/testing';
import { aRecord } from './sql-trail-fixture';

/** A trail that archives, and what tampers with it the way somebody with access to the store would. */
export interface ArchiveFixture {
  readonly trail: AuditTrailUnderContract & ArchivableAuditTrail;
  /** Changes the action of an entry in the store itself, the guard set aside. */
  tamper(id: string): Promise<void>;
  /** A statement on the store: `$table` names the entries, `$schema` the schema of the trail. */
  run?(statement: string): Promise<unknown>;
  /**
   * Removes the entries of a chain from a sequence on, behind the back of the trail: its head
   * still names them.
   */
  cut(chain: string, fromSequence: number): Promise<void>;
  /** Records an archive row nobody archived, as a role that may insert into the archives would. */
  forgeArchive(archive: AuditArchive): Promise<void>;
  /**
   * Deletes the entries of a chain up to a sequence, the guard on: what it lets through once an
   * archive row covers them.
   */
  removeCovered(chain: string, toSequence: number): Promise<void>;
}

/** The fixture of a SQL store: the tail cut and the archive forged by statements on the store. */
export function sqlArchiveFixture(
  trail: ArchiveFixture['trail'],
  tamper: (id: string) => Promise<void>,
  run: (statement: string) => Promise<unknown>,
): ArchiveFixture {
  return {
    trail,
    tamper,
    run,
    cut: async (chain, fromSequence) => {
      await run('alter table $table disable trigger "audit_entries_no_rewrite"');
      await run(`delete from $table where "chain" = '${chain}' and "sequence" >= ${String(fromSequence)}`);
      await run('alter table $table enable trigger "audit_entries_no_rewrite"');
    },
    forgeArchive: async (archive) => {
      const { chain, fromSequence, toSequence, lastHash, entries, fileKey, fileDigest } = archive;

      await run(
        `insert into $schema."audit_archives" ("chain", "from_sequence", "to_sequence", "last_hash", "entries", "file_key", "file_digest", "archived_at") values ('${chain}', ${String(fromSequence)}, ${String(toSequence)}, '${lastHash}', ${String(entries)}, '${fileKey}', '${fileDigest}', now())`,
      );
    },
    removeCovered: async (chain, toSequence) => {
      await run(`delete from $table where "chain" = '${chain}' and "sequence" <= ${String(toSequence)}`);
    },
  };
}

export const JANUARY = new Date('2026-01-15T10:00:00.000Z');
export const FEBRUARY = new Date('2026-02-15T10:00:00.000Z');
export const MARCH = new Date('2026-03-15T10:00:00.000Z');
export const clock = new FixedClock(new Date('2026-04-01T00:00:00.000Z'));

export async function recordAt(trail: AuditTrail, id: string, at: Date, tenant = 'acme'): Promise<void> {
  await trail.record({ ...aRecord(id, tenant), occurredAt: at });
}

/** An archive row of `tenant:acme` that no file backs, over the range it is given. */
export function forgedArchive(range: {
  readonly fromSequence?: number;
  readonly toSequence: number;
  readonly lastHash: string;
}): AuditArchive {
  const { fromSequence = 1, toSequence, lastHash } = range;

  return {
    chain: 'tenant:acme',
    fromSequence,
    toSequence,
    lastHash,
    entries: toSequence - fromSequence + 1,
    fileKey: 'audit-archives/none.ndjson',
    fileDigest: 'none',
    archivedAt: new Date(0),
  };
}
