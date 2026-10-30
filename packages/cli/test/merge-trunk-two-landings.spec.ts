import { describe, expect, it } from 'vitest';
import { commitFiles, mergeTrunk, onBranch, squashInto, trunkRepository } from './support/trunk-history';

const INVOICE = 'src/contexts/billing/invoice.ts';

describe('merge-trunk: two landings found on the trunk', () => {
  it('takes the newest, here the one of the branch it shares a commit with', () => {
    const root = trunkRepository({ [INVOICE]: 'class Invoice {\n}\n' });

    onBranch(root, 'build/billing-1');
    const shared = commitFiles(root, { [INVOICE]: 'class Invoice {\n  issue() {}\n}\n' }, 'feat(billing): issue');

    onBranch(root, 'build/billing-2');
    commitFiles(root, { 'src/pay.ts': 'export const pay = 1;\n' }, 'feat(billing): pay');

    onBranch(root, 'build/billing-1');
    commitFiles(root, {}, 'chore: review, nothing to change');

    const squash = squashInto(root, 'build/billing-1', { message: 'feat(billing): issue (#1)' });

    onBranch(root, 'build/billing-2');

    expect(mergeTrunk(root, '--dry-run', '--json').json()).toMatchObject({
      base: { commit: shared, evidence: 'landed', landedAs: { commit: squash, from: 'build/billing-1' } },
    });
  });
});
