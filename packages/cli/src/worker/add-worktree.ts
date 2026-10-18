import { CliError } from '../cli-error.js';
import { runGit } from '../commit/run-git.js';
import { branchExists } from './branch-exists.js';

/** Adds the worktree on its branch: an existing branch is checked out, a new one is cut from the base. */
export function addWorktree(root: string, place: { worktree: string; branch: string; base: string }): void {
  const { worktree, branch, base } = place;
  const target = branchExists(root, branch) ? [branch] : ['-b', branch, base];
  const added = runGit(root, ['worktree', 'add', worktree, ...target]);

  if (added === undefined) {
    throw new CliError(
      `git could not add the worktree ${worktree} on the branch ${branch}.`,
      `Run \`git worktree add ${worktree} ${target.join(' ')}\` to read its reason; a branch checked out elsewhere takes --branch <name>.`,
    );
  }
}
