import { CliError } from '../cli-error';
import { runGit } from '../commit/run-git';

/**
 * Refuses a branch that does not contain the base: a worker on it would build on a stale
 * trunk, and its merge would undo what the trunk gained since. The fix is merge-trunk, which
 * brings the base in from what of the branch it already holds (a squash-merged first row): a
 * plain `git merge` would conflict again on everything that landed.
 */
export function ensureContainsBase(root: string, branch: string, base: string): void {
  if (runGit(root, ['merge-base', '--is-ancestor', base, branch]) !== undefined) {
    return;
  }

  throw new CliError(
    `The branch ${branch} does not contain ${base}: its worker would build on a stale base.`,
    `Bring it up to date first: \`npx ddd-ts-kit merge-trunk --trunk ${base} --cwd <worktree>\` (never a plain \`git merge\`, which conflicts again on what already landed), or pass the base it was cut from with --base <ref>.`,
  );
}
