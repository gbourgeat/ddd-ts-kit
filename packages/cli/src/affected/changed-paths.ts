import { commitOf } from '../commit/commit-of';
import { runGit } from '../commit/run-git';

/**
 * The paths that differ between `base` and `head`, relative to the project at `root`; a path of
 * the repository outside the project keeps a leading `../`. A rename is its old path and its new
 * one. Each ref is resolved to its commit first, so that only hashes reach `git diff`. Undefined
 * when git cannot tell (not a repository, a ref that names no commit, a shallow clone without
 * the base): the caller then selects everything.
 */
export function changedPaths(root: string, base: string, head: string): string[] | undefined {
  const prefix = runGit(root, ['rev-parse', '--show-prefix'])?.trim();
  const from = commitOf(root, base);
  const to = commitOf(root, head);

  if (prefix === undefined || from === undefined || to === undefined) {
    return undefined;
  }

  // Three dots would need the history between the two; the merge base is asked for and used when the clone has it.
  const fork = runGit(root, ['merge-base', '--end-of-options', from, to])?.trim() || from;
  const diff = runGit(root, ['diff', '--name-only', '--no-renames', '-z', '--end-of-options', fork, to]);

  return diff
    ?.split('\0')
    .filter((file) => file !== '')
    .map((file) => (file.startsWith(prefix) ? file.slice(prefix.length) : `../${file}`));
}
