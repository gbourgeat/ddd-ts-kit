import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyResolutions } from '../src/merge/apply-resolutions';
import { revisionFiles } from '../src/merge/lost/revision-files';
import { mergeTrunk as mergeTrunkIn } from '../src/merge/merge-trunk';
import { objectBytes } from '../src/merge/object-bytes';
import { branchStanding } from '../src/worker/branch-standing';
import { read } from './helpers';
import { git } from './support/git';
import { withGitAnswering } from './support/git-answering';
import { commitFiles, mergeTrunk, merging, onBranch, trunkRepository } from './support/trunk-history';

const INVOICE = 'src/contexts/billing/invoice.ts';
const SUBMODULE = 'vendor/lib';

/** `build/billing` checked out, one commit behind `main`, which changed another file. */
function behindTheTrunk(): string {
  const root = trunkRepository({ [INVOICE]: 'class Invoice {\n}\n' });

  onBranch(root, 'build/billing');
  commitFiles(root, { [INVOICE]: 'class Invoice {\n  pay() {}\n}\n' }, 'feat(billing): pay');
  onBranch(root, 'main');
  commitFiles(root, { 'src/people.ts': 'class People {\n}\n' }, 'feat(people): list people (#2)');
  onBranch(root, 'build/billing');

  return root;
}

/** Commits the submodule at a commit of its own, named by the digit `digit` repeated: it is never checked out. */
function pointSubmoduleAt(root: string, digit: string): void {
  git(root, 'update-index', '--add', '--cacheinfo', `160000,${digit.repeat(40)},${SUBMODULE}`);
  git(root, 'commit', '--quiet', '--message', `chore: the submodule at ${digit}`);
}

describe('merge-trunk: what git answers before the merge', () => {
  it('counts an untracked path gone before the look at it as a change of the working tree', () => {
    const root = behindTheTrunk();

    const refused = withGitAnswering({ when: 'status --porcelain -z', answer: "printf '?? ghost.ts\\0'" }, () =>
      mergeTrunk(root),
    );

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('error: The working tree is not clean: ghost.ts.');
    expect(merging(root)).toBe(false);
  });
});

describe('the objects of a merge, when git cat-file --batch stops short', () => {
  const twoFiles = (): string => trunkRepository({ 'a.txt': 'first', 'b.txt': 'second' });
  const stoppedShort = { when: 'cat-file --batch', answer: '"$GIT" "$@" | head -n 2' };

  it('keeps the bytes of the names it answered, and leaves out the others', () => {
    const root = twoFiles();
    const bytes = withGitAnswering(stoppedShort, () => objectBytes(root, ['HEAD:a.txt', 'HEAD:b.txt']));

    expect([...bytes].map(([name, content]) => [name, content.toString('utf8')])).toEqual([['HEAD:a.txt', 'first']]);
  });

  it('keeps the text of the paths it answered at a revision, and leaves out the others', () => {
    const root = twoFiles();
    const files = withGitAnswering(stoppedShort, () => revisionFiles(root, 'HEAD', ['a.txt', 'b.txt']));

    expect([...files]).toEqual([['a.txt', 'first']]);
  });
});

describe('a merge, when git refuses a step', () => {
  it('says that git could not stage what merge-trunk settled, with what git answered', () => {
    const root = trunkRepository({ 'a.txt': 'first\n' });

    const settled = {
      file: 'a.txt',
      kind: 'derived',
      content: 'settled\n',
      settled: true,
      how: 'trunk',
      blocks: [],
    } as const;

    expect(() =>
      withGitAnswering({ when: '--pathspec-from-file', answer: 'echo "fatal: index locked" >&2; exit 128' }, () =>
        applyResolutions(root, [settled]),
      ),
    ).toThrow('git could not stage the paths merge-trunk settled: fatal: index locked.');

    expect(read(root, 'a.txt')).toBe('settled\n');
  });

  it('leaves out the preview of a branch git cannot merge, the standing being read, never refused', () => {
    const root = behindTheTrunk();

    const standing = withGitAnswering({ when: 'merge-tree', answer: 'exit 128' }, () =>
      branchStanding(root, root, 'main'),
    );

    expect(standing).toMatchObject({ ahead: 1, behind: 1 });
    expect(standing).not.toHaveProperty('mergePreview');
  });
});

describe('a conflicted path that is no file in the working tree', () => {
  it("reads nothing of what the merge wrote at a submodule both sides moved, which stays a person's", () => {
    const root = trunkRepository({ 'a.txt': 'first\n' });

    fs.mkdirSync(path.join(root, SUBMODULE), { recursive: true });
    pointSubmoduleAt(root, 'a');
    onBranch(root, 'build/billing');
    pointSubmoduleAt(root, 'b');
    onBranch(root, 'main');
    pointSubmoduleAt(root, 'c');
    onBranch(root, 'build/billing');

    const old = { root, trunk: 'main', toLand: false, dryRun: false, gitVersion: 'git version 2.39.2' };

    expect(mergeTrunkIn(old)).toMatchObject({ status: 'stopped', conflicts: { plainMerge: 1, forYou: 1 } });
    expect(git(root, 'ls-files', '--unmerged', '--', SUBMODULE)).toContain('160000');
  });
});
