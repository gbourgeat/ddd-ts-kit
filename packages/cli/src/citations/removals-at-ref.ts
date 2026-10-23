import { runGit } from '../commit/run-git';
import type { History } from './history';
import { historyOf } from './history-of';

/** A commit as `historyOf` reads it: abbreviated hash, day, commit time, subject. */
const FORMAT = '--format=@%h%x09%cs%x09%ct%x09%s';

/**
 * Everything the history of a ref removed and added under the source root, in one pass of
 * `git log` with renames detected: each removal with its commit, day and subject, where the file
 * went, and the files the same commit added.
 */
export function removalsAtRef(root: string, ref: string, sourceRoot: string): History {
  const log = runGit(root, [
    'log',
    ref,
    '--diff-filter=ADR',
    '-M',
    '--name-status',
    '--relative',
    FORMAT,
    '--',
    sourceRoot,
  ]);

  return historyOf(log ?? '', ref);
}
