import { CliError } from '../cli-error';
import { runGit } from '../commit/run-git';
import type { Base } from './base-of';

/**
 * Refuses a branch that does not contain the base: a worker on it would build on a stale
 * trunk, and its merge would undo what the trunk gained since. The fix is merge-trunk, which
 * brings the base in from what of the branch it already holds (a squash-merged first row): a
 * plain `git merge` would conflict again on everything that landed. Git is given the commit of
 * the base, never its name, which may start with a dash.
 */
export function ensureContainsBase(root: string, branch: string, base: Base): void {
  if (runGit(root, ['merge-base', '--is-ancestor', '--end-of-options', base.commit, branch]) !== undefined) {
    return;
  }

  throw new CliError(
    `The branch ${branch} does not contain ${base.name}: its worker would build on a stale base.`,
    `Bring it up to date first: \`npx ddd-ts-kit merge-trunk --trunk ${base.name} --cwd <worktree>\` (never a plain \`git merge\`, which conflicts again on what already landed), or pass the base it was cut from with --base <ref>.`,
  );
}
