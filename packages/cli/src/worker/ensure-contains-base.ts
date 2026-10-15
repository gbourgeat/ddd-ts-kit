import { CliError } from '../cli-error.js';
import { runGit } from '../commit/run-git.js';

/**
 * Refuses a branch that does not contain the base: a worker on it would build on a stale
 * trunk, and its merge would undo what the trunk gained since.
 */
export function ensureContainsBase(root: string, branch: string, base: string): void {
  if (runGit(root, ['merge-base', '--is-ancestor', base, branch]) !== undefined) {
    return;
  }

  throw new CliError(
    `The branch ${branch} does not contain ${base}: its worker would build on a stale base.`,
    `Bring it up to date first (\`git -C <worktree> merge ${base}\`, or rebase it), or pass the base it was cut from with --base <ref>.`,
  );
}
