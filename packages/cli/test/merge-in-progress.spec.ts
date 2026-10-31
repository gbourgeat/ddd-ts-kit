import { describe, expect, it } from 'vitest';
import { cli } from './helpers';
import { git } from './support/git';
import { commitFiles, goOn, mergeTrunk, merging, onBranch, trunkRepository } from './support/trunk-history';

/** The branch and the trunk both write `docs/a.txt`: merge-trunk stops with one path left for a person. */
function stopped(): string {
  const root = trunkRepository({
    '.gitignore': '.ddd-ts-kit/\nnode_modules/\n',
    'ddd-ts-kit.config.json': JSON.stringify({ contexts: {} }),
    'package.json': JSON.stringify({ name: 'billing', scripts: {} }),
    'docs/a.txt': 'one\n',
  });

  onBranch(root, 'feat/x');
  commitFiles(root, { 'docs/a.txt': 'branch\n' }, 'feat: a');
  onBranch(root, 'main');
  commitFiles(root, { 'docs/a.txt': 'trunk\n' }, 'feat: a (#2)');
  onBranch(root, 'feat/x');

  return root;
}

describe('a merge left in progress', () => {
  const WAY_ON =
    'Merge in progress: feat/x <- main, 1 path left for you when it stopped: `npx ddd-ts-kit merge-trunk --continue` or `--abort`.';

  it('is the first thing status and doctor say, with the way on', () => {
    const root = stopped();

    expect(mergeTrunk(root).code).toBe(1);
    expect(merging(root)).toBe(true);
    expect(cli(root, 'status').stdout.split('\n')[0]).toBe(WAY_ON);
    expect(cli(root, 'doctor').stdout.split('\n')[0]).toBe(WAY_ON);
    expect(cli(root, 'status', '--json').json()).toMatchObject({ mergeInProgress: WAY_ON });
    expect(cli(root, 'doctor', '--json').json()).toMatchObject({ mergeInProgress: WAY_ON });
  }, 60_000);

  it('names only --abort when the merge was not started by merge-trunk', () => {
    const root = stopped();

    try {
      git(root, 'merge', '--no-commit', '--no-ff', 'main');
    } catch {
      // The conflict is the point.
    }

    const [first] = cli(root, 'status').stdout.split('\n');

    expect(first).toContain('not started by merge-trunk');
    expect(first).toContain('npx ddd-ts-kit merge-trunk --abort');
  }, 60_000);

  it('says nothing once the merge is aborted', () => {
    const root = stopped();

    mergeTrunk(root);
    expect(goOn(root, '--abort').code).toBe(0);
    expect(cli(root, 'status').stdout).not.toContain('Merge in progress');
    expect(cli(root, 'doctor').stdout).not.toContain('Merge in progress');
    expect(cli(root, 'status', '--json').json()).not.toHaveProperty('mergeInProgress');
  }, 60_000);
});
