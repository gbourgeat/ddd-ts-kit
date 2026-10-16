import { runGit } from '../commit/run-git.js';

/** A renamed file counts under both its names: either can meet the change of another worker. */
const NAMES = ['--name-only', '--no-renames', '-z'];

/**
 * The files a worktree changed, relative to its top, sorted: committed since `mergeBase` when
 * given, modified (staged or not), and untracked but not ignored. The scope and the report of a
 * worker, under `.ddd-ts-kit/`, are not counted.
 */
export function changedFiles(worktree: string, mergeBase: string | undefined): string[] {
  const committed = mergeBase === undefined ? [] : names(worktree, ['diff', ...NAMES, mergeBase, 'HEAD']);
  const modified = names(worktree, ['diff', ...NAMES, 'HEAD']);
  const untracked = names(worktree, ['ls-files', '--others', '--exclude-standard', '-z']);

  return [...new Set([...committed, ...modified, ...untracked])]
    .filter((file) => !/(^|\/)\.ddd-ts-kit\//.test(file))
    .sort();
}

function names(worktree: string, args: readonly string[]): string[] {
  return (runGit(worktree, args) ?? '').split('\0').filter((name) => name !== '');
}
