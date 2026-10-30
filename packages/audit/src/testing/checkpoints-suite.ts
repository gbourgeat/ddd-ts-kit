import type { AuditEntry } from '@ddd-ts-kit/kernel';
import { ContractSuite, type ContractRunner } from '@ddd-ts-kit/testing/contracts';
import type { AuditCheckpoint } from '../chain/audit-checkpoint';
import { verifyChain } from '../verify/verify-chain';
import type { AuditTrailContractOptions } from './audit-trail-contract-options';
import type { AuditTrailUnderContract } from './audit-trail-under-contract';
import { entriesOf } from './entries-of';
import { inTenant } from './records/in-tenant';
import { recordAll } from './record-all';

const ALPHA = 'tenant:alpha';
const FIVE_ENTRIES = Array.from({ length: 5 }, (_, index) => inTenant(`a-${index}`, 'alpha'));

/** What a chain owes to the checkpoints published elsewhere: a cut at its tail does not pass for the whole chain. */
export class CheckpointsSuite extends ContractSuite<AuditTrailUnderContract> {
  private readonly options: AuditTrailContractOptions;

  constructor(runner: ContractRunner, options: AuditTrailContractOptions) {
    super(runner, () => options.createTrail());
    this.options = options;
  }

  protected tests(): void {
    this.showsACutTail();
    this.readsItsOwnCheckpoints();
  }

  private showsACutTail(): void {
    const cutAtThree = { kind: 'missing-entry', chain: ALPHA, position: 3, sequence: 4 };

    this.it('shows a chain cut at its tail against a later checkpoint', async () => {
      await recordAll(this.subject, FIVE_ENTRIES);

      const entries = await entriesOf(this.subject, ALPHA);
      const checkpoints = checkpointsAt(entries, 5);

      this.expect(await verifyChain(this.subject, { chain: ALPHA, checkpoints })).toEqual({ valid: true, checked: 5 });

      this.expect(await verifyChain(entries.slice(0, 3), { chain: ALPHA, checkpoints })).toEqual({
        valid: false,
        checked: 3,
        break: cutAtThree,
      });

      const { cut } = this.options;

      if (cut === undefined) {
        return;
      }

      await cut(ALPHA, 4);

      this.expect(await verifyChain(this.subject, { chain: ALPHA, checkpoints })).toEqual({
        valid: false,
        checked: 3,
        break: cutAtThree,
      });
    });
  }

  private readsItsOwnCheckpoints(): void {
    this.it('reads a checkpoint inside the range asked for only', async () => {
      await recordAll(this.subject, FIVE_ENTRIES);

      const checkpoints = checkpointsAt(await entriesOf(this.subject, ALPHA), 5);

      this.expect(await verifyChain(this.subject, { chain: ALPHA, to: 3, checkpoints })).toEqual({
        valid: true,
        checked: 3,
      });
    });

    this.it('reads the checkpoints of the chain it verifies', async () => {
      await recordAll(this.subject, [inTenant('a-1', 'alpha'), inTenant('b-1', 'beta'), inTenant('b-2', 'beta')]);

      const checkpoints = checkpointsAt(await entriesOf(this.subject, 'tenant:beta'), 2);

      this.expect(await verifyChain(this.subject, { chain: ALPHA, checkpoints })).toEqual({ valid: true, checked: 1 });
    });
  }
}

function checkpointsAt(entries: readonly AuditEntry[], sequence: number): readonly AuditCheckpoint[] {
  return entries.filter((entry) => entry.sequence === sequence).map(({ chain, hash }) => ({ chain, sequence, hash }));
}
