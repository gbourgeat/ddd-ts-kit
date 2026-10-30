import { runGit } from '../commit/run-git';
import type { ChangedPath } from './changed-path';
import type { Change } from './digest';

/**
 * The files of the project that HEAD changes since the base commit, relative to the project root,
 * by path, in the order of their code points (a `CONTEXT.md` before the files beside it). A renamed file is the removal of one path and the addition of another, as a reviewer
 * reads them.
 */
export function changedPaths(root: string, base: string, head: string): ChangedPath[] {
  const listed = runGit(root, [
    'diff',
    '--name-status',
    '--no-renames',
    '--relative',
    '-z',
    '--end-of-options',
    base,
    head,
    '--',
  ]);

  const fields = (listed ?? '').split('\0');
  const paths: ChangedPath[] = [];

  for (let at = 0; at + 1 < fields.length; at += 2) {
    paths.push({ path: fields[at + 1] ?? '', change: changeOf(fields[at] ?? '') });
  }

  return paths
    .filter((changed) => changed.path !== '')
    .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
}

/** `A` added, `D` deleted; `M` and a type change are changes. */
function changeOf(status: string): Change {
  if (status.startsWith('A')) {
    return 'added';
  }

  return status.startsWith('D') ? 'removed' : 'changed';
}
