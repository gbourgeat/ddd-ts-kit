import { CliError } from '../cli-error';
import { runGit } from '../commit/run-git';
import { branchExists } from './branch-exists';

/**
 * Adds the worktree on its branch: an existing branch is checked out, a new one is cut from the base
 * with `--no-track`: a worker's branch needs no upstream, and recording one writes `.git/config`,
 * which the Claude Code sandbox keeps read-only.
 */
export function addWorktree(root: string, place: { worktree: string; branch: string; base: string }): void {
  const { worktree, branch, base } = place;
  const target = branchExists(root, branch) ? [branch] : ['--no-track', '-b', branch, base];
  const added = runGit(root, ['worktree', 'add', worktree, ...target]);

  if (added === undefined) {
    throw new CliError(
      `git could not add the worktree ${worktree} on the branch ${branch}.`,
      `Run \`git worktree add ${worktree} ${target.join(' ')}\` to read its reason; a branch checked out elsewhere takes --branch <name>.`,
    );
  }
}
