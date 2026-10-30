import { describe, expect, it } from 'vitest';
import { InMemoryFileStorage } from '@ddd-ts-kit/kernel';
import { AuditArchiveRefusedError } from '../../src';
import { JANUARY, MARCH, clock, recordAt, type ArchiveFixture } from './archive-fixture';
import { sequencesOf } from './sql-trail-fixture';

async function refusalOfArchive(archiving: Promise<unknown>): Promise<AuditArchiveRefusedError> {
  const failure: unknown = await archiving.then(
    () => undefined,
    (error: unknown) => error,
  );

  if (failure instanceof AuditArchiveRefusedError) {
    return failure;
  }

  throw new Error(`Expected a refused archive, got ${String(failure)}`);
}

export function archiveRefusalSpecs(name: string, create: () => Promise<ArchiveFixture>): void {
  describe(`${name}: a chain that does not verify`, () => {
    it('stops its own archive only: the other chains are archived, then the refusal is thrown', async () => {
      const { trail, tamper } = await create();
      const files = new InMemoryFileStorage();

      await recordAt(trail, 'acme-january', JANUARY);
      await recordAt(trail, 'north-january', JANUARY, 'north');
      await recordAt(trail, 'south-january', JANUARY, 'south');
      await tamper('north-january');

      const refusal = await refusalOfArchive(trail.archiveBefore(MARCH, { files, clock }));

      expect(refusal.refusals).toEqual([
        {
          chain: 'tenant:north',
          chainBreak: {
            kind: 'altered-content',
            chain: 'tenant:north',
            position: 0,
            sequence: 1,
            entryId: 'north-january',
          },
        },
      ]);

      expect(refusal.archives.map(({ chain }) => chain)).toEqual(['tenant:acme', 'tenant:south']);
      expect(await sequencesOf(trail)).toEqual([]);
      expect(await sequencesOf(trail, 'tenant:south')).toEqual([]);
      expect(await sequencesOf(trail, 'tenant:north')).toEqual([{ id: 'north-january', sequence: 1 }]);
      expect(await trail.archivesOf('tenant:north')).toEqual([]);
    });

    it('reports every chain refused at once, each with its own break', async () => {
      const { trail, tamper } = await create();

      await recordAt(trail, 'acme-january', JANUARY);
      await recordAt(trail, 'north-january', JANUARY, 'north');
      await tamper('acme-january');
      await tamper('north-january');

      const refusal = await refusalOfArchive(trail.archiveBefore(MARCH, { files: new InMemoryFileStorage(), clock }));

      expect(refusal.refusals.map(({ chain }) => chain)).toEqual(['tenant:acme', 'tenant:north']);
      expect(refusal.archives).toEqual([]);
    });
  });
}
