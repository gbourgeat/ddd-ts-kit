import { ContractSuite } from '@ddd-ts-kit/testing/contracts';
import { GENESIS_HASH } from '../chain/genesis-hash';
import { hashOf } from '../chain/hash-of';
import { verifyChain } from '../verify/verify-chain';
import type { AuditTrailUnderContract } from './audit-trail-under-contract';
import { entriesOf } from './entries-of';
import { inTenant } from './records/in-tenant';
import { textsOf } from './records/texts-of';
import { recordAll } from './record-all';

const ALPHA = 'tenant:alpha';

/** The entry a store keeps is the entry it hashed, whatever text a record holds. */
export class SealedTextsSuite extends ContractSuite<AuditTrailUnderContract> {
  protected tests(): void {
    this.seals();
    this.leavesWellFormedTextsAlone();
    this.keepsOneChainPerStoredName();
  }

  private seals(): void {
    const cases: readonly (readonly [string, string, string])[] = [
      ['a high surrogate alone', 'x\ud800', 'x\ufffd'],
      ['a low surrogate alone', '\udc00x', '\ufffdx'],
      ['a NUL', 'x\u0000y', 'x\ufffdy'],
    ];

    for (const [name, text, stored] of cases) {
      this.it(`seals and stores the same entry when a text holds ${name}`, async () => {
        const entered = textsOf(text);

        await recordAll(this.subject, [inTenant('a-0', 'alpha'), entered, inTenant('a-2', 'alpha')]);

        const [first, second] = await entriesOf(this.subject, ALPHA);

        this.expect(second).toEqual({
          ...textsOf(stored),
          chain: ALPHA,
          sequence: 2,
          previousHash: first?.hash,
          hash: second?.hash,
        });

        this.expect(second === undefined ? undefined : hashOf(second)).toBe(second?.hash);
        this.expect(await verifyChain(this.subject, { chain: ALPHA })).toEqual({ valid: true, checked: 3 });
      });
    }
  }

  private leavesWellFormedTextsAlone(): void {
    this.it('leaves a text that is well formed as it is, a pair of surrogates included', async () => {
      const entered = textsOf('caf\u00e9 \ud83d\ude00 \ufffd');

      await this.subject.record(entered);

      const [entry] = await entriesOf(this.subject, ALPHA);

      this.expect(entry).toEqual({
        ...entered,
        chain: ALPHA,
        sequence: 1,
        previousHash: GENESIS_HASH,
        hash: entry?.hash,
      });
    });
  }

  private keepsOneChainPerStoredName(): void {
    this.it('keeps one chain for two tenants whose names store alike', async () => {
      await recordAll(this.subject, [
        inTenant('a-1', 'x\ud800'),
        inTenant('a-2', 'x\ud801'),
        inTenant('a-3', 'x\u0000'),
      ]);

      const chain = 'tenant:x\ufffd';

      this.expect((await entriesOf(this.subject, chain)).map((entry) => entry.sequence)).toEqual([1, 2, 3]);
      this.expect(await verifyChain(this.subject, { chain })).toEqual({ valid: true, checked: 3 });
    });
  }
}
