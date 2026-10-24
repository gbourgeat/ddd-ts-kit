import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { FixedClock, InMemoryFileStorage, type AuditTrail } from '@ddd-ts-kit/kernel';
import {
  AuditArchiveRefusedError,
  verifyArchive,
  verifyChain,
  type ArchivableAuditTrail,
  type AuditArchive,
} from '../../src';
import type { AuditTrailUnderContract } from '../../src/testing';
import { CHAIN, aRecord, sequencesOf } from './sql-trail-fixture';

/** A trail that archives, and what tampers with it the way an attacker with access to the store would. */
export interface ArchiveFixture {
  readonly trail: AuditTrailUnderContract & ArchivableAuditTrail;
  /** Changes the action of an entry in the store itself, the guard set aside. */
  tamper(id: string): Promise<void>;
  /** A statement on the store: `$table` names the entries, `$schema` the schema of the trail. */
  run?(statement: string): Promise<unknown>;
}

const JANUARY = new Date('2026-01-15T10:00:00.000Z');
const FEBRUARY = new Date('2026-02-15T10:00:00.000Z');
const MARCH = new Date('2026-03-15T10:00:00.000Z');
const clock = new FixedClock(new Date('2026-04-01T00:00:00.000Z'));

async function recordAt(trail: AuditTrail, id: string, at: Date, tenant = 'acme'): Promise<void> {
  await trail.record({ ...aRecord(id, tenant), occurredAt: at });
}

async function textOf(files: InMemoryFileStorage, archive: AuditArchive): Promise<string> {
  const content = await files.get(archive.fileKey);
  const chunks: Buffer[] = [];

  for await (const chunk of content?.stream ?? []) {
    chunks.push(Buffer.from(String(chunk)));
  }

  return Buffer.concat(chunks).toString('utf8');
}

/** What every trail that archives is held to: the stores of the four ORMs and the one in memory. */
export function archiveSpecs(name: string, create: () => Promise<ArchiveFixture>): void {
  rangeSpecs(name, create);
  integritySpecs(name, create);
}

function rangeSpecs(name: string, create: () => Promise<ArchiveFixture>): void {
  describe(`${name}: the archives of the trail`, () => {
    it('moves the entries older than the date to one file per chain, verified, and the trail goes on from the anchor', async () => {
      const { trail } = await create();
      const files = new InMemoryFileStorage();

      await recordAt(trail, 'january', JANUARY);
      await recordAt(trail, 'february', FEBRUARY);
      await recordAt(trail, 'march', MARCH);
      await recordAt(trail, 'north-january', JANUARY, 'north');

      const { archives } = await trail.archiveBefore(MARCH, { files, clock });

      expect(
        archives.map(({ chain, fromSequence, toSequence, entries, fileKey }) => ({
          chain,
          fromSequence,
          toSequence,
          entries,
          fileKey,
        })),
      ).toEqual([
        {
          chain: 'tenant:acme',
          fromSequence: 1,
          toSequence: 2,
          entries: 2,
          fileKey: 'audit-archives/tenant/acme/000000000001-000000000002.ndjson',
        },
        {
          chain: 'tenant:north',
          fromSequence: 1,
          toSequence: 1,
          entries: 1,
          fileKey: 'audit-archives/tenant/north/000000000001-000000000001.ndjson',
        },
      ]);

      expect(await sequencesOf(trail)).toEqual([{ id: 'march', sequence: 3 }]);

      const [acme] = archives;

      expect(acme?.archivedAt).toEqual(clock.now());
      expect(await trail.archivesOf(CHAIN)).toEqual([acme]);

      expect(acme === undefined ? undefined : verifyArchive(await textOf(files, acme), acme)).toEqual({
        valid: true,
        entries: 2,
      });

      await recordAt(trail, 'april', MARCH);

      const anchor = acme === undefined ? undefined : { chain: CHAIN, sequence: acme.toSequence, hash: acme.lastHash };

      await expect(
        verifyChain(trail, { chain: CHAIN, from: 3, ...(anchor === undefined ? {} : { after: anchor }) }),
      ).resolves.toEqual({
        valid: true,
        checked: 2,
      });
    });

    it('goes on from the archive before at the next run, which reaches nothing when nothing is older', async () => {
      const { trail } = await create();
      const files = new InMemoryFileStorage();

      await recordAt(trail, 'january', JANUARY);
      await recordAt(trail, 'february', FEBRUARY);

      const [first] = (await trail.archiveBefore(FEBRUARY, { files, clock })).archives;
      const [second] = (await trail.archiveBefore(MARCH, { files, clock })).archives;

      expect(second).toMatchObject({ fromSequence: 2, toSequence: 2 });

      expect(second === undefined ? undefined : verifyArchive(await textOf(files, second), second, first)).toEqual({
        valid: true,
        entries: 1,
      });

      expect((await trail.archiveBefore(MARCH, { files, clock })).archives).toEqual([]);
      expect(await trail.archivesOf(CHAIN)).toHaveLength(2);
    });

    it('archives a chain from its start only: an entry dated after the date ends the range', async () => {
      const { trail } = await create();

      await recordAt(trail, 'january', JANUARY);
      await recordAt(trail, 'march', MARCH);
      await recordAt(trail, 'february-late', FEBRUARY);

      const { archives } = await trail.archiveBefore(MARCH, { files: new InMemoryFileStorage(), clock });

      expect(archives.map(({ toSequence }) => toSequence)).toEqual([1]);
      expect((await sequencesOf(trail)).map(({ id }) => id)).toEqual(['march', 'february-late']);
    });
  });
}

function digestOf(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function integritySpecs(name: string, create: () => Promise<ArchiveFixture>): void {
  describe(`${name}: what an archive proves`, () => {
    it('shows a file altered after it was written, and one read against the wrong archive before', async () => {
      const { trail } = await create();
      const files = new InMemoryFileStorage();

      await recordAt(trail, 'january', JANUARY);
      await recordAt(trail, 'february', FEBRUARY);

      const [archive] = (await trail.archiveBefore(MARCH, { files, clock })).archives;

      expect(archive).toBeDefined();

      if (archive !== undefined) {
        const text = await textOf(files, archive);

        expect(verifyArchive(text.replace('january', 'forged'), archive)).toEqual({ valid: false, reason: 'digest' });

        expect(
          verifyArchive(text.replace('january', 'forged'), {
            ...archive,
            fileDigest: digestOf(text.replace('january', 'forged')),
          }),
        ).toEqual({ valid: false, reason: 'chain', sequence: 1 });

        expect(verifyArchive(text, { ...archive, lastHash: 'other' })).toEqual({ valid: false, reason: 'anchor' });

        expect(verifyArchive(text, archive, { toSequence: 5, lastHash: 'other' })).toEqual({
          valid: false,
          reason: 'range',
        });
      }
    });

    it('refuses a chain that does not verify: its entries stay, and no file is written', async () => {
      const { trail, tamper } = await create();
      const files = new InMemoryFileStorage();

      await recordAt(trail, 'january', JANUARY);
      await tamper('january');

      await expect(trail.archiveBefore(MARCH, { files, clock })).rejects.toThrow(AuditArchiveRefusedError);
      expect(await sequencesOf(trail)).toEqual([{ id: 'january', sequence: 1 }]);
      expect(await trail.archivesOf(CHAIN)).toEqual([]);
    });
  });
}

/** What the guard keeps of the archives in a database: the archived entries alone may go, the archives never. */
export function archiveGuardSpecs(name: string, create: () => Promise<ArchiveFixture>): void {
  describe(`${name}: the guard of the archives`, () => {
    it('still refuses the DELETE of an entry no archive covers, and any rewrite of an archive', async () => {
      const { trail, run } = await create();

      await recordAt(trail, 'january', JANUARY);
      await recordAt(trail, 'march', MARCH);
      await trail.archiveBefore(FEBRUARY, { files: new InMemoryFileStorage(), clock });

      expect(await refusalOf(run?.('delete from $table'))).toContain('append-only');

      expect(await refusalOf(run?.('update $schema."audit_archives" set "last_hash" = \'forged\''))).toContain(
        'append-only',
      );

      expect(await refusalOf(run?.('delete from $schema."audit_archives"'))).toContain('append-only');
      expect(await sequencesOf(trail)).toEqual([{ id: 'march', sequence: 2 }]);
    });
  });
}

/** The message of the refusal of the database, whether the driver error comes bare or as the cause of another (drizzle). */
async function refusalOf(statement: Promise<unknown> | undefined): Promise<string> {
  const failure: unknown = await statement?.then(
    () => undefined,
    (error: unknown) => error,
  );

  const cause: unknown = Reflect.get(Object(failure), 'cause');

  return `${String(Reflect.get(Object(failure), 'message'))} ${String(Reflect.get(Object(cause), 'message'))}`;
}
