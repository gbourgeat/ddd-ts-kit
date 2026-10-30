import { describe, expect, it } from 'vitest';
import { mergeTrunk as mergeTrunkIn } from '../src/merge/merge-trunk';
import { git } from './support/git';
import { commitFiles, mergeTrunk, merging, onBranch, trunkRepository } from './support/trunk-history';

const INVOICE = 'src/contexts/billing/invoice.ts';

/**
 * A repository whose branch pays, and whose trunk gained a file no file system writes: its empty
 * blob goes straight into the index, under a name of three hundred characters. The branch is
 * checked out; switching back from the trunk left the absence of the file behind with its commit.
 */
function trunkWithAnUnwritableFile(): string {
  const root = trunkRepository({ [INVOICE]: 'class Invoice {\n}\n' });

  onBranch(root, 'build/billing');
  commitFiles(root, { [INVOICE]: 'class Invoice {\n  pay() {}\n}\n' }, 'feat(billing): pay');
  onBranch(root, 'main');

  const blob = git(root, 'hash-object', '-w', '--stdin').trim();

  git(root, 'update-index', '--add', '--cacheinfo', `100644,${blob},src/${'x'.repeat(300)}.ts`);
  git(root, 'commit', '--quiet', '--message', 'feat: a file too long to write (#2)');
  git(root, 'switch', '--quiet', '--force', 'build/billing');

  return root;
}

describe('merge-trunk: a file of the trunk that cannot be created here', () => {
  it('says that git could not write the trunk while starting the merge, and leaves no merge', () => {
    const root = trunkWithAnUnwritableFile();
    const refused = mergeTrunk(root);

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('git read-tree failed while starting the merge:');
    expect(refused.stderr).toContain('run `git reset --merge`, then merge-trunk again');
  });

  it('with a git older than 2.40, says that git merge could not start', () => {
    const root = trunkWithAnUnwritableFile();
    const fork = git(root, 'merge-base', 'HEAD', 'main').trim();
    const old = { root, trunk: 'main', toLand: false, dryRun: false, gitVersion: 'git version 2.39.2', since: fork };

    expect(() => mergeTrunkIn(old)).toThrow(/git merge could not start: /);
    expect(merging(root)).toBe(false);
  });
});
