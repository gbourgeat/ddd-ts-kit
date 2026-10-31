import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { InMemoryFileStorage, type FileContent } from '@ddd-ts-kit/kernel';
import { verifyTrail } from '../../src';
import { entriesOf } from '../../src/testing/entries-of';
import { FEBRUARY, JANUARY, MARCH, clock, forgedArchive, recordAt, type ArchiveFixture } from './archive-fixture';

/** A storage that answers every read with an error, as one that is down does. */
class FailingStorage extends InMemoryFileStorage {
  override async get(): Promise<FileContent | undefined> {
    throw new Error('the storage is down');
  }
}

/**
 * What the verification of a trail owes to the rows of its archives: they follow each other, and
 * the head goes on from the last.
 */
export function archiveAnchorSpecs(name: string, create: () => Promise<ArchiveFixture>): void {
  describe(`${name}: the head against the archives`, () => {
    it('does not verify a chain whose head is behind its last archive', async () => {
      const { trail, forgeArchive } = await create();

      await recordAt(trail, 'january', JANUARY);
      await recordAt(trail, 'february', FEBRUARY);
      await forgeArchive(forgedArchive({ toSequence: 5, lastHash: 'h' }));

      expect((await verifyTrail(trail)).breaks).toEqual([
        { kind: 'altered-content', chain: 'tenant:acme', position: 0, sequence: 2 },
      ]);
    });

    it('does not verify a chain whose head ends where its last archive does with another hash', async () => {
      const { trail, forgeArchive } = await create();

      await recordAt(trail, 'january', JANUARY);
      await recordAt(trail, 'february', FEBRUARY);
      await forgeArchive(forgedArchive({ toSequence: 2, lastHash: 'another' }));

      expect((await verifyTrail(trail)).breaks).toEqual([
        { kind: 'altered-content', chain: 'tenant:acme', position: 0, sequence: 2 },
      ]);
    });

    it('does not verify archives that leave a gap between them', async () => {
      const { trail, forgeArchive } = await create();
      const files = new InMemoryFileStorage();

      await recordAt(trail, 'january', JANUARY);
      await recordAt(trail, 'february', FEBRUARY);
      await recordAt(trail, 'march', MARCH);
      await trail.archiveBefore(FEBRUARY, { files, clock });

      const [, march] = await entriesOf(trail, 'tenant:acme');

      await forgeArchive(forgedArchive({ fromSequence: 3, toSequence: 3, lastHash: march?.hash ?? '' }));

      expect((await verifyTrail(trail)).breaks).toEqual([
        { kind: 'missing-entry', chain: 'tenant:acme', position: 0, sequence: 2 },
      ]);
    });
  });

  describe(`${name}: the archives read back`, () => {
    it('reads back every archive of a chain, the earlier ones too', async () => {
      const { trail } = await create();
      const files = new InMemoryFileStorage();

      await recordAt(trail, 'january', JANUARY);
      await recordAt(trail, 'february', FEBRUARY);
      await recordAt(trail, 'march', MARCH);
      await trail.archiveBefore(FEBRUARY, { files, clock });
      await trail.archiveBefore(MARCH, { files, clock });

      expect(await verifyTrail(trail, { files })).toEqual({ valid: true, checked: 1, breaks: [] });

      const [first] = await trail.archivesOf('tenant:acme');

      await files.put(first?.fileKey ?? '', Readable.from([Buffer.from('{}\n')]), {
        mediaType: 'application/x-ndjson',
      });

      expect((await verifyTrail(trail, { files })).breaks).toEqual([
        { kind: 'altered-content', chain: 'tenant:acme', position: 0, sequence: 1 },
      ]);
    });

    it('names a storage that fails as the break of its chain, and verifies the other chains all the same', async () => {
      const { trail } = await create();

      await recordAt(trail, 'january', JANUARY);
      await recordAt(trail, 'march', MARCH);
      await recordAt(trail, 'north-march', MARCH, 'north');
      await trail.archiveBefore(FEBRUARY, { files: new InMemoryFileStorage(), clock });

      expect(await verifyTrail(trail, { files: new FailingStorage() })).toEqual({
        valid: false,
        checked: 1,
        breaks: [{ kind: 'unreadable-archive', chain: 'tenant:acme', position: 0, sequence: 1 }],
      });
    });
  });
}
