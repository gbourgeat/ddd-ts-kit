import { describe, expect, it } from 'vitest';
import { exists } from './helpers';
import { git } from './support/git';
import {
  commitFiles,
  goOn,
  mergeTrunk,
  merging,
  onBranch,
  squashInto,
  trunkRepository,
  workerFile,
} from './support/trunk-history';

const INVOICE = 'src/contexts/billing/invoice.ts';
const HANDLER = 'src/contexts/billing/pay/handler.ts';

const invoice = (...methods: string[]): string =>
  ['export class Invoice {', '  constructor() {}', ...methods.map((method) => `  ${method}`), '}', ''].join('\n');

/** The first row of build/billing landed by squash; the branch then adds the pay handler, then pay(). */
function reusedAfterItsFirstRow(): { root: string; afterTheLanding: string } {
  const root = trunkRepository({ [INVOICE]: invoice() });

  onBranch(root, 'build/billing');
  commitFiles(root, { [INVOICE]: invoice('issue() { return 1; }') }, 'row 1: issue');
  squashInto(root, 'build/billing', { message: 'feat(billing): issue (#1)' });
  commitFiles(root, { 'docs/notes.md': 'Unrelated.\n' }, 'docs: notes (#2)');
  onBranch(root, 'build/billing');

  const afterTheLanding = commitFiles(root, { [HANDLER]: 'export const payHandler = 1;\n' }, 'row 2: pay handler');

  commitFiles(root, { [INVOICE]: invoice('issue() { return 1; }', 'pay() { return 2; }') }, 'row 2: pay');

  return { root, afterTheLanding };
}

describe('merge-trunk: a --since the trunk does not hold', () => {
  it('refuses a --since that names the head of the branch, which would leave the trunk alone in the result', () => {
    const { root } = reusedAfterItsFirstRow();
    const head = git(root, 'rev-parse', 'HEAD').trim();

    for (const since of ['HEAD', head]) {
      const refused = mergeTrunk(root, '--since', since);

      expect(refused.code).toBe(2);
      expect(refused.stderr).toContain(`--since ${since} is the head of this branch`);
      expect(refused.stderr).toContain('the result would be the trunk alone');
    }

    expect(merging(root)).toBe(false);
    expect(git(root, 'rev-parse', 'HEAD').trim()).toBe(head);
  });

  it('stops on the file of the branch the merge dropped, when --since names a commit made after the landing', () => {
    const { root, afterTheLanding } = reusedAfterItsFirstRow();
    const stopped = mergeTrunk(root, '--since', afterTheLanding, '--json');

    expect(stopped.code).toBe(1);

    expect(stopped.json()).toMatchObject({
      status: 'stopped',
      base: { commit: afterTheLanding, evidence: 'option' },
      lostLines: { errors: [{ kind: 'file-deleted', file: HANDLER, side: 'ours' }] },
    });

    expect(merging(root)).toBe(true);
    expect(exists(root, HANDLER)).toBe(false);
    expect(goOn(root, '--abort').code).toBe(0);
    expect(mergeTrunk(root, '--json').json()).toMatchObject({ status: 'committed', lostLines: { errors: [] } });
    expect(exists(root, HANDLER)).toBe(true);
  });
});

describe('merge-trunk: the trunk of a worker', () => {
  it('brings in the base recorded for the worker of the worktree, unless --trunk names another', () => {
    const { root } = reusedAfterItsFirstRow();

    git(root, 'branch', 'release', 'main~2');
    workerFile(root, { base: 'main' });

    const recorded = goOn(root, '--dry-run', '--json');
    const named = goOn(root, '--trunk', 'release', '--dry-run', '--json');

    expect(recorded.json()).toMatchObject({
      status: 'dry-run',
      trunk: { ref: 'main', commit: git(root, 'rev-parse', 'main').trim() },
    });

    expect(named.json()).toMatchObject({ status: 'up-to-date', trunk: { ref: 'release' } });
  });
});
