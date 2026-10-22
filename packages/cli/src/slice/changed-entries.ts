import { runGit } from '../commit/run-git';
import type { ChangedEntry } from './changed-entry';

/**
 * Every path modified or new in the working tree, from `git status -z`, which keeps a name with
 * spaces or accents whole; a rename gives its new path.
 */
export function changedEntries(root: string): ChangedEntry[] {
  const fields = (runGit(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']) ?? '').split('\0');
  const entries: ChangedEntry[] = [];

  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index] ?? '';

    if (field.length > 3) {
      const status = field.slice(0, 2);

      entries.push({ path: field.slice(3), tracked: status !== '??' });
      // A rename or a copy is followed by the path it came from.
      index += /[RC]/.test(status) ? 1 : 0;
    }
  }

  return entries;
}
