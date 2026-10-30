import { describe, expect, it } from 'vitest';
import { cli } from './helpers';
import { git } from './support/git';
import { withGitAnswering } from './support/git-answering';
import { initProject } from './support/init-project';
import { slicedProject } from './support/sliced-project';

describe('digest refuses, exit 2, what it cannot compare', () => {
  it.each([[[]], [['--base=']]])('refuses without a base (%j), and names the ref to give', (base) => {
    const refused = cli(initProject(), 'digest', ...base);

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('error: digest compares the branch with the commit it was cut from.');
    expect(refused.stderr).toContain('fix: Name it: `ddd-ts-kit digest --base origin/main`');
  });

  it('refuses a project outside a git repository', () => {
    const root = initProject();
    const refused = cli(root, 'digest', '--base', 'main', '--json');

    expect(refused.code).toBe(2);

    expect(refused.json()).toMatchObject({
      error: {
        message: `${root} is not inside a git repository.`,
        fix: 'Run it from the worktree of the branch, or pass --cwd <worktree>: the digest reads what the branch committed.',
      },
    });
  });

  it('refuses a repository without a commit', () => {
    const root = initProject();

    git(root, 'init', '--quiet', '--initial-branch', 'main');

    const refused = cli(root, 'digest', '--base', 'main');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('error: The repository has no commit yet.');
  });

  it('refuses a ref git does not know, a ref that starts with a dash among them', () => {
    const root = slicedProject();

    for (const ref of ['origin/trunk', '--output=digest.txt']) {
      const refused = cli(root, 'digest', `--base=${ref}`);

      expect(refused.code).toBe(2);
      expect(refused.stderr).toContain(`error: ${ref} is not a commit of this repository.`);
      expect(refused.stderr).toContain('fix: Fetch it first (`git fetch origin`), or name the base of the branch');
    }
  });

  it('refuses a tree git could not write, and says where to look', () => {
    const root = slicedProject();

    const refused = withGitAnswering({ when: 'checkout-index', answer: 'exit 1' }, () =>
      cli(root, 'digest', '--base', 'main'),
    );

    expect(refused.code).toBe(2);
    expect(refused.stderr).toMatch(/error: The tree of [0-9a-f]{7} could not be written under /);
    expect(refused.stderr).toContain('fix: Check the room left in the temporary directory of the system');
  });

  it('refuses a base that shares no history with HEAD', () => {
    const root = slicedProject();

    git(root, 'checkout', '--quiet', '--orphan', 'elsewhere');
    git(root, 'commit', '--quiet', '--allow-empty', '--message', 'chore: another history');
    git(root, 'checkout', '--quiet', 'slice/issue-invoice');

    const refused = cli(root, 'digest', '--base', 'elsewhere');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('error: elsewhere shares no history with HEAD.');
  });
});
