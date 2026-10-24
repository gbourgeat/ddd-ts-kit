import { runGit } from '../commit/run-git';

/**
 * The files of the project changed since `ref`, relative to the project root: committed since it,
 * modified, and untracked but not ignored. Nothing when the project is not in a git repository or
 * `ref` is unknown.
 */
export function changedFiles(root: string, ref: string): ReadonlySet<string> | undefined {
  const committed = runGit(root, ['diff', '--name-only', '--relative', '-z', ref]);

  if (committed === undefined) {
    return undefined;
  }

  const untracked = runGit(root, ['ls-files', '--others', '--exclude-standard', '-z']) ?? '';

  return new Set([...committed.split('\0'), ...untracked.split('\0')].filter((file) => file !== ''));
}
