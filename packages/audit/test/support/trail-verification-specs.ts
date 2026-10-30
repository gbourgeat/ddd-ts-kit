import { describe, expect, it } from 'vitest';
import { InMemoryFileStorage } from '@ddd-ts-kit/kernel';
import { AuditTrailBrokenError, VerifyAuditTrail, verifyTrail } from '../../src';
import { FEBRUARY, JANUARY, MARCH, clock, recordAt, type ArchiveFixture } from './archive-fixture';
import { entriesOf } from '../../src/testing/entries-of';

/**
 * What every trail that archives answers to the verification of all its chains, each from its last
 * archive to its head.
 */
export function trailVerificationSpecs(name: string, create: () => Promise<ArchiveFixture>): void {
  describe(`${name}: the verification of every chain`, () => {
    it('gives the head of every chain, in the order of their names, archived entries counted', async () => {
      const { trail } = await create();

      await recordAt(trail, 'north-january', JANUARY, 'north');
      await recordAt(trail, 'january', JANUARY);
      await recordAt(trail, 'march', MARCH);
      await trail.archiveBefore(FEBRUARY, { files: new InMemoryFileStorage(), clock });

      const [march] = await entriesOf(trail, 'tenant:acme');

      expect(await trail.chainHeads()).toEqual([
        { chain: 'tenant:acme', sequence: 2, hash: march?.hash },
        { chain: 'tenant:north', sequence: 1, hash: expect.any(String) },
      ]);
    });

    it('verifies each chain from its last archive, so a trail that archived verifies', async () => {
      const { trail } = await create();

      await recordAt(trail, 'january', JANUARY);
      await recordAt(trail, 'february', FEBRUARY);
      await recordAt(trail, 'north-january', JANUARY, 'north');
      await trail.archiveBefore(MARCH, { files: new InMemoryFileStorage(), clock });
      await recordAt(trail, 'march', MARCH);

      expect(await verifyTrail(trail)).toEqual({ valid: true, checked: 1, breaks: [] });
      await expect(new VerifyAuditTrail(trail).run()).resolves.toBeUndefined();
    });

    it('reports the first break of each chain, the other chains verified all the same', async () => {
      const { trail, tamper } = await create();

      await recordAt(trail, 'january', JANUARY);
      await recordAt(trail, 'march', MARCH);
      await recordAt(trail, 'north-january', JANUARY, 'north');
      await recordAt(trail, 'south-january', JANUARY, 'south');
      await tamper('march');
      await tamper('south-january');

      const verification = await verifyTrail(trail);

      expect(verification).toEqual({
        valid: false,
        checked: 2,
        breaks: [
          { kind: 'altered-content', chain: 'tenant:acme', position: 1, sequence: 2, entryId: 'march' },
          { kind: 'altered-content', chain: 'tenant:south', position: 0, sequence: 1, entryId: 'south-january' },
        ],
      });

      const failure = await new VerifyAuditTrail(trail).run().then(
        () => undefined,
        (error: unknown) => error,
      );

      expect(failure).toBeInstanceOf(AuditTrailBrokenError);
      expect(failure).toMatchObject({ code: 'AUDIT_TRAIL_BROKEN', breaks: verification.breaks });

      expect(String(failure)).toContain(
        'tenant:acme (altered-content at sequence 2), tenant:south (altered-content at sequence 1)',
      );
    });

    it('does not verify a chain cut at its tail: the head says how far it goes', async () => {
      const { trail, cut } = await create();

      await recordAt(trail, 'january', JANUARY);
      await recordAt(trail, 'february', FEBRUARY);
      await recordAt(trail, 'march', MARCH);
      await cut('tenant:acme', 3);

      expect(await verifyTrail(trail)).toEqual({
        valid: false,
        checked: 2,
        breaks: [{ kind: 'missing-entry', chain: 'tenant:acme', position: 2, sequence: 3 }],
      });
    });
  });
}
