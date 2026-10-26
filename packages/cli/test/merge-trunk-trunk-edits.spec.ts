import { describe, expect, it } from 'vitest';
import { write } from './helpers';
import { git } from './support/git';
import { commitFiles, goOn, mergeTrunk, onBranch, trunkRepository } from './support/trunk-history';

const TEAM_SPEC = 'src/contexts/catalogue/team.aggregate.spec.ts';
const INVOICE = 'src/contexts/billing/invoice.ts';

const spec = (...tests: readonly string[]): string =>
  ["describe('Team', () => {", ...tests.map((test) => `  ${test}`), '});', ''].join('\n');

const invoice = (...methods: readonly string[]): string =>
  ['export class Invoice {', ...methods.map((method) => `  ${method}`), '}', ''].join('\n');

const TODOS = ["it.todo('renames the team');", "it.todo('archives the team');"];
const REAL = ["it('renames the team', () => {", '    expect(1).toBe(1);', '  });'];

/**
 * The branch is cut, takes the todo markers of a spec of another context from the trunk with an
 * earlier merge, then the trunk replaces them. The base of the merge is older than that earlier merge.
 */
function trunkReplacesWhatTheBranchTook(branchWork: Record<string, string>): { root: string; since: string } {
  const root = trunkRepository({ [TEAM_SPEC]: spec(), [INVOICE]: invoice() });

  onBranch(root, 'build/billing');
  const since = commitFiles(root, { [INVOICE]: invoice('issue() { return 1; }') }, 'feat(billing): issue');

  onBranch(root, 'main');
  commitFiles(root, { [TEAM_SPEC]: spec(...TODOS) }, 'feat(catalogue): team markers');

  onBranch(root, 'build/billing');
  git(root, 'merge', '--quiet', '--no-ff', '--message', 'Merge main into build/billing', 'main');
  commitFiles(root, branchWork, 'feat(billing): cancel');

  onBranch(root, 'main');
  commitFiles(root, { [TEAM_SPEC]: spec(...REAL) }, 'feat(catalogue): team tests');
  onBranch(root, 'build/billing');

  return { root, since };
}

describe('merge-trunk: what the trunk itself removed since the base is no loss', () => {
  it('reports no loss in a spec of another context the branch never touched, where the trunk replaced markers', () => {
    const { root, since } = trunkReplacesWhatTheBranchTook({
      [INVOICE]: invoice('issue() { return 1; }', 'cancel() { return 0; }'),
    });

    const result = mergeTrunk(root, '--since', since, '--json');

    expect(result.code).toBe(1);
    write(root, TEAM_SPEC, spec(...REAL));
    write(root, INVOICE, invoice('issue() { return 1; }', 'cancel() { return 0; }'));
    git(root, 'add', TEAM_SPEC, INVOICE);

    const done = goOn(root, '--continue', '--json');

    expect(done.code).toBe(0);
    expect(done.json()).toMatchObject({ status: 'committed', lostLines: { errors: [] } });
  });

  it('still reports a line of the branch the merge dropped in a file the branch touched', () => {
    const { root, since } = trunkReplacesWhatTheBranchTook({
      [INVOICE]: invoice('issue() { return 1; }', 'cancel() { return 0; }'),
    });

    mergeTrunk(root, '--since', since);
    write(root, TEAM_SPEC, spec(...REAL));
    write(root, INVOICE, invoice('issue() { return 1; }'));
    git(root, 'add', TEAM_SPEC, INVOICE);

    const stopped = goOn(root, '--continue', '--json');

    expect(stopped.code).toBe(1);

    expect(stopped.json()).toMatchObject({
      status: 'stopped',
      lostLines: { errors: [{ kind: 'lost-line', file: INVOICE, side: 'ours', text: 'cancel() { return 0; }' }] },
    });
  });
});
