import { runGit } from '../commit/run-git.js';

/**
 * The paths that differ between `base` and `head`, relative to the project at `root`; a path of
 * the repository outside the project keeps a leading `../`. A rename is its old path and its new
 * one. Undefined when git cannot tell (not a repository, an unknown ref, a shallow clone without
 * the base): the caller then selects everything.
 */
export function changedPaths(root: string, base: string, head: string): string[] | undefined {
  const prefix = runGit(root, ['rev-parse', '--show-prefix'])?.trim();
  // Three dots would need the history between the two; the merge base is asked for and used when the clone has it.
  const from = runGit(root, ['merge-base', base, head])?.trim() || base;
  const diff = runGit(root, ['diff', '--name-only', '--no-renames', '-z', from, head]);

  if (prefix === undefined || diff === undefined) {
    return undefined;
  }

  return diff
    .split('\0')
    .filter((file) => file !== '')
    .map((file) => (file.startsWith(prefix) ? file.slice(prefix.length) : `../${file}`));
}
