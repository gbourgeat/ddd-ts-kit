import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { write } from './helpers';
import { git } from './support/git';
import { commitFiles, goOn, mergeTrunk, merging, onBranch, trunkRepository } from './support/trunk-history';

/** A regenerate script that records whether the state of the merge was on disk when it ran: a kill there is a merge in progress. */
const SEES_THE_STATE = `node -e "require('fs').writeFileSync('state-seen', String(require('fs').existsSync('.ddd-ts-kit/merge.json')))"`;

/** The branch and the trunk each add a file: nothing for a person, the merge goes through on its own. */
function disjoint(): string {
  const root = trunkRepository({
    '.gitignore': '.ddd-ts-kit/\nnode_modules/\nstate-seen\n',
    'ddd-ts-kit.config.json': JSON.stringify({ contexts: {} }),
    'package.json': JSON.stringify({ name: 'billing', scripts: { regenerate: SEES_THE_STATE } }),
  });

  onBranch(root, 'feat/x');
  commitFiles(root, { 'docs/a.txt': 'a\n' }, 'feat: a');
  onBranch(root, 'main');
  commitFiles(root, { 'docs/b.txt': 'b\n' }, 'feat: b (#2)');
  onBranch(root, 'feat/x');

  return root;
}

describe('merge-trunk, a merge that is stopped before its end', () => {
  it('keeps the state of the merge on disk from the moment it starts, so that --continue can go on', () => {
    const root = disjoint();

    expect(mergeTrunk(root).code).toBe(0);
    expect(fs.readFileSync(path.join(root, 'state-seen'), 'utf8')).toBe('true');
    expect(fs.existsSync(path.join(root, '.ddd-ts-kit/merge.json'))).toBe(false);
  }, 60_000);

  it('goes on with --continue from the state a stop of the automatic path left', () => {
    const root = disjoint();

    write(
      root,
      'package.json',
      JSON.stringify({ name: 'billing', scripts: { regenerate: 'node -e "process.exit(3)"' } }),
    );

    git(root, 'add', 'package.json');
    git(root, 'commit', '--quiet', '-m', 'chore: regenerate fails');
    expect(mergeTrunk(root).code).toBe(1);
    expect(merging(root)).toBe(true);

    write(root, 'package.json', JSON.stringify({ name: 'billing', scripts: { regenerate: 'node -e ""' } }));
    git(root, 'add', 'package.json');
    expect(goOn(root, '--continue', '--json').json()).toMatchObject({ status: 'committed' });
  }, 60_000);

  it('names the command that undoes a merge in progress that holds no state', () => {
    const root = disjoint();

    try {
      git(root, 'merge', '--no-commit', '--no-ff', 'main');
    } catch {
      // Nothing to settle here: the merge waits for its commit.
    }

    const refused = goOn(root, '--continue');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('npx ddd-ts-kit merge-trunk --abort');
    expect(refused.stderr).not.toContain('not started by merge-trunk');
  });
});
