import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { InMemoryFileStorage } from '@ddd-ts-kit/kernel';
import { VerifyAuditTrail, verifyTrail } from '../../src';
import { entriesOf } from '../../src/testing/entries-of';
import { FEBRUARY, JANUARY, MARCH, clock, forgedArchive, recordAt, type ArchiveFixture } from './archive-fixture';

/** What the verification of a trail owes to the archives: the row of the last one is proved against its file. */
export function archiveProofSpecs(name: string, create: () => Promise<ArchiveFixture>): void {
  describe(`${name}: the archives the verification proves`, () => {
    it('proves the last archive of each chain against its file when given the storage', async () => {
      const { trail } = await create();
      const files = new InMemoryFileStorage();

      await recordAt(trail, 'january', JANUARY);
      await recordAt(trail, 'march', MARCH);
      await trail.archiveBefore(FEBRUARY, { files, clock });

      expect(await verifyTrail(trail, { files })).toEqual({ valid: true, checked: 1, breaks: [] });
      await expect(new VerifyAuditTrail(trail, files).run()).resolves.toBeUndefined();

      expect((await verifyTrail(trail, { files: new InMemoryFileStorage() })).breaks).toEqual([
        { kind: 'missing-entry', chain: 'tenant:acme', position: 0, sequence: 1 },
      ]);

      const [archive] = await trail.archivesOf('tenant:acme');
      const changed = new InMemoryFileStorage();

      await changed.put(archive?.fileKey ?? '', Readable.from([Buffer.from('{}\n')]), {
        mediaType: 'application/x-ndjson',
      });

      expect((await verifyTrail(trail, { files: changed })).breaks).toEqual([
        { kind: 'altered-content', chain: 'tenant:acme', position: 0, sequence: 1 },
      ]);
    });

    it('reports entries let go under an archive row that no file proves', async () => {
      const { trail, forgeArchive, removeCovered } = await create();
      const files = new InMemoryFileStorage();

      await recordAt(trail, 'january', JANUARY);
      await recordAt(trail, 'february', FEBRUARY);
      await recordAt(trail, 'march', MARCH);

      const [, february] = await entriesOf(trail, 'tenant:acme');

      await forgeArchive(forgedArchive({ toSequence: 2, lastHash: february?.hash ?? '' }));
      await removeCovered('tenant:acme', 2);

      expect(await verifyTrail(trail)).toEqual({ valid: true, checked: 1, breaks: [] });

      expect(await verifyTrail(trail, { files })).toEqual({
        valid: false,
        checked: 0,
        breaks: [{ kind: 'missing-entry', chain: 'tenant:acme', position: 0, sequence: 1 }],
      });
    });
  });
}
