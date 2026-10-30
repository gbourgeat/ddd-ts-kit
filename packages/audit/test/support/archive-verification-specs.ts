import { describe, expect, it } from 'vitest';
import { InMemoryFileStorage } from '@ddd-ts-kit/kernel';
import { verifyChain, type AuditCheckpoint } from '../../src';
import { FEBRUARY, JANUARY, MARCH, clock, recordAt, type ArchiveFixture } from './archive-fixture';
import { CHAIN } from './sql-trail-fixture';

async function archivedAndGoingOn(trail: ArchiveFixture['trail']): Promise<AuditCheckpoint> {
  const files = new InMemoryFileStorage();

  await recordAt(trail, 'january', JANUARY);
  await recordAt(trail, 'february', FEBRUARY);
  await recordAt(trail, 'march', MARCH);
  await recordAt(trail, 'april', MARCH);

  await trail.archiveBefore(FEBRUARY, { files, clock });
  await trail.archiveBefore(MARCH, { files, clock });

  const last = (await trail.archivesOf(CHAIN)).at(-1);

  if (last === undefined) {
    throw new Error('The chain was not archived');
  }

  return { chain: CHAIN, sequence: last.toSequence, hash: last.lastHash };
}

export function archiveVerificationSpecs(name: string, create: () => Promise<ArchiveFixture>): void {
  describe(`${name}: the verification of a chain that has archives`, () => {
    it('verifies the entries left from the anchor of the last archive, with no other position to give', async () => {
      const { trail } = await create();
      const after = await archivedAndGoingOn(trail);

      expect(await verifyChain(trail, { chain: CHAIN, after })).toEqual({ valid: true, checked: 2 });
    });

    it('says the first entry is missing when no anchor says where the chain goes on from', async () => {
      const { trail } = await create();

      await archivedAndGoingOn(trail);

      expect(await verifyChain(trail, { chain: CHAIN })).toMatchObject({
        valid: false,
        checked: 0,
        break: { kind: 'missing-entry', position: 0, sequence: 1 },
      });
    });

    it('shows entries that do not go on from the anchor they are given', async () => {
      const { trail } = await create();
      const after = await archivedAndGoingOn(trail);

      expect(await verifyChain(trail, { chain: CHAIN, after: { ...after, hash: 'other' } })).toEqual({
        valid: false,
        checked: 0,
        break: { kind: 'altered-content', chain: CHAIN, position: 0, sequence: 3, entryId: 'march' },
      });
    });
  });
}
