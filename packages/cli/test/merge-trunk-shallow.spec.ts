import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, tempDir } from './helpers';
import { git } from './support/git';
import { commitFiles, onBranch, trunkRepository } from './support/trunk-history';

/** A clone of a repository whose branch and trunk share a history, cut to one commit on each: no merge base is left. */
function shallowClone(): string {
  const origin = trunkRepository({ 'docs/base.txt': 'base\n' });

  onBranch(origin, 'feat/x');
  commitFiles(origin, { 'docs/a.txt': 'a\n' }, 'feat: a');
  onBranch(origin, 'main');
  commitFiles(origin, { 'docs/b.txt': 'b\n' }, 'feat: b (#2)');

  const clone = path.join(tempDir('shallow'), 'r');

  git(origin, 'clone', '--quiet', '--depth', '1', '--no-single-branch', `file://${origin}`, clone);
  git(clone, 'fetch', '--quiet', '--depth', '1', 'origin', '+refs/heads/feat/x:refs/remotes/origin/feat/x');
  git(clone, 'fetch', '--quiet', '--depth', '1', 'origin', '+refs/heads/main:refs/remotes/origin/main');
  git(clone, 'checkout', '--quiet', '-b', 'w', 'origin/feat/x');

  return clone;
}

describe('a shallow clone that holds no merge base', () => {
  it('has merge-trunk say the clone is shallow and what deepens it', () => {
    const refused = cli(shallowClone(), 'merge-trunk', '--trunk', 'origin/main');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('shallow');
    expect(refused.stderr).toContain('git fetch --unshallow');
  });

  it('has verify-merge refuse instead of answering nothing', () => {
    const refused = cli(shallowClone(), 'verify-merge', '--since', 'origin/main');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('shallow');
    expect(refused.stderr).toContain('git fetch --unshallow');
  });
});
