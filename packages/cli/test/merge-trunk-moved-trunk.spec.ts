import { describe, expect, it } from 'vitest';
import { write } from './helpers';
import { git } from './support/git';
import { commitFiles, goOn, mergeTrunk, onBranch, trunkRepository } from './support/trunk-history';

const INVOICE = 'src/contexts/billing/invoice.ts';

/** Moves `main` one commit on, without touching the worktree, which is in the middle of a merge. */
function moveTrunk(root: string): string {
  const moved = git(root, 'commit-tree', 'main^{tree}', '-p', 'main', '-m', 'feat: more (#3)').trim();

  git(root, 'update-ref', 'refs/heads/main', moved);

  return moved;
}

/** A merge in progress on a conflict, the conflict settled by hand. */
function settled(): string {
  const root = trunkRepository({ [INVOICE]: 'class Invoice {\n}\n' });

  onBranch(root, 'build/billing');
  commitFiles(root, { [INVOICE]: 'class Invoice {\n  pay() {}\n}\n' }, 'feat(billing): pay');
  onBranch(root, 'main');
  commitFiles(root, { [INVOICE]: 'class Invoice {\n  cancel() {}\n}\n' }, 'feat: cancel (#2)');
  onBranch(root, 'build/billing');

  expect(mergeTrunk(root).code).toBe(1);

  write(root, INVOICE, 'class Invoice {\n  pay() {}\n  cancel() {}\n}\n');
  git(root, 'add', INVOICE);

  return root;
}

describe('merge-trunk --continue: a trunk that moved since the merge started', () => {
  it('says which commit the merge concludes and what to do', () => {
    const root = settled();
    const started = git(root, 'rev-parse', 'main').trim();

    const moved = moveTrunk(root);

    const done = goOn(root, '--continue', '--json');

    expect(done.json()).toMatchObject({
      status: 'committed',
      trunkMoved: { merged: started, now: moved },
    });
  }, 60_000);

  it('prints the warning in the text report', () => {
    const root = settled();

    moveTrunk(root);

    const out = goOn(root, '--continue').stdout;

    expect(out).toContain('trunk moved: main was');
    expect(out).toContain('run `npx ddd-ts-kit merge-trunk` again');
  }, 60_000);

  it('says nothing when the trunk did not move', () => {
    const root = settled();

    const done = goOn(root, '--continue', '--json').json();

    expect(done).not.toHaveProperty('trunkMoved');
  }, 60_000);
});
