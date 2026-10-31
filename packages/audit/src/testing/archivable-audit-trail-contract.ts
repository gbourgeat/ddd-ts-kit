import { InMemoryFileStorage, FixedClock, type AuditRecord } from '@ddd-ts-kit/kernel';
import { ContractSuite, type ContractRunner } from '@ddd-ts-kit/testing/contracts';
import type { ArchivableAuditTrail } from '../archive/archivable-audit-trail';
import { verifyTrail } from '../verify/verify-trail';
import type { ArchivableAuditTrailContractOptions } from './archivable-audit-trail-contract-options';
import type { AuditTrailUnderContract } from './audit-trail-under-contract';
import { entriesOf } from './entries-of';
import { inTenant } from './records/in-tenant';
import { recordAll } from './record-all';

const ALPHA = 'tenant:alpha';
const JANUARY = new Date('2026-01-15T10:00:00.000Z');
const MARCH = new Date('2026-03-15T10:00:00.000Z');
const FEBRUARY_FIRST = new Date('2026-02-01T00:00:00.000Z');
const clock = new FixedClock(new Date('2026-04-01T00:00:00.000Z'));

/**
 * What every trail that archives guarantees to the verification: the head of each chain
 * (`chainHeads`), the archives it wrote (`archivesOf`) and the archive itself (`archiveBefore`),
 * so that `verifyTrail` walks each chain from its last archive to its head.
 */
export function archivableAuditTrailContract(
  runner: ContractRunner,
  options: ArchivableAuditTrailContractOptions,
): void {
  new ArchivableAuditTrailSuite(runner, options).describe(`${options.name} (archivable audit trail contract)`);
}

class ArchivableAuditTrailSuite extends ContractSuite<AuditTrailUnderContract & ArchivableAuditTrail> {
  private readonly options: ArchivableAuditTrailContractOptions;

  constructor(runner: ContractRunner, options: ArchivableAuditTrailContractOptions) {
    super(runner, () => options.createTrail());
    this.options = options;
  }

  protected tests(): void {
    this.givesItsHeads();
    this.archives();
    this.showsACutTail();
  }

  private givesItsHeads(): void {
    this.it('starts with no head and no archive', async () => {
      this.expect(await this.subject.chainHeads()).toEqual([]);
      this.expect(await this.subject.archivesOf(ALPHA)).toEqual([]);
    });

    this.it(
      'gives the head of every chain, the sequence and the hash of its last entry, in the order of their names',
      async () => {
        await recordAll(this.subject, [
          at('b-1', 'beta', JANUARY),
          at('a-1', 'alpha', JANUARY),
          at('a-2', 'alpha', MARCH),
        ]);

        const [, last] = await entriesOf(this.subject, ALPHA);
        const [beta] = await entriesOf(this.subject, 'tenant:beta');

        this.expect(await this.subject.chainHeads()).toEqual([
          { chain: ALPHA, sequence: 2, hash: last?.hash },
          { chain: 'tenant:beta', sequence: 1, hash: beta?.hash },
        ]);
      },
    );
  }

  private archives(): void {
    this.it(
      'archives the entries older than the date, lists the archive, and keeps the head where it was',
      async () => {
        const files = new InMemoryFileStorage();

        await recordAll(this.subject, [at('a-1', 'alpha', JANUARY), at('a-2', 'alpha', MARCH)]);

        const heads = await this.subject.chainHeads();
        const [first] = await entriesOf(this.subject, ALPHA);
        const { archives } = await this.subject.archiveBefore(FEBRUARY_FIRST, { files, clock });

        this.expect(
          archives.map(({ chain, fromSequence, toSequence, lastHash }) => ({
            chain,
            fromSequence,
            toSequence,
            lastHash,
          })),
        ).toEqual([{ chain: ALPHA, fromSequence: 1, toSequence: 1, lastHash: first?.hash }]);

        this.expect(await this.subject.archivesOf(ALPHA)).toEqual(archives);
        this.expect((await entriesOf(this.subject, ALPHA)).map(({ sequence }) => sequence)).toEqual([2]);
        this.expect(await this.subject.chainHeads()).toEqual(heads);
        this.expect(await verifyTrail(this.subject, { files })).toEqual({ valid: true, checked: 1, breaks: [] });
      },
    );
  }

  private showsACutTail(): void {
    this.it('does not verify a chain cut at its tail, against its head', async () => {
      await recordAll(this.subject, [
        at('a-1', 'alpha', JANUARY),
        at('a-2', 'alpha', MARCH),
        at('a-3', 'alpha', MARCH),
      ]);

      const { cut } = this.options;

      // A store that gives no way to cut its tail behind its back: the cut is not checked.
      if (cut === undefined) {
        return;
      }

      await cut(ALPHA, 3);

      this.expect(await verifyTrail(this.subject)).toEqual({
        valid: false,
        checked: 2,
        breaks: [{ kind: 'missing-entry', chain: ALPHA, position: 2, sequence: 3 }],
      });
    });
  }
}

/** A record of the tenant, at the instant given. */
function at(id: string, tenantId: string, occurredAt: Date): AuditRecord {
  return { ...inTenant(id, tenantId), occurredAt };
}
