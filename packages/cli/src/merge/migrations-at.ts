import path from 'node:path';
import type { Migration } from '../check/migrations/migration-folder';
import { runGit } from '../commit/run-git';

const SCRIPTS = ['.js', '.ts', '.mjs', '.cjs', '.sql'];

/**
 * The migrations a commit holds in `folder` (relative to the project root, git run from it), by
 * name: the files of a migration tool, or the folders of Prisma (`directories`), each with the
 * file that holds its statements.
 */
export function migrationsAt(
  root: string,
  commit: string,
  { folder, directories }: { folder: string; directories: boolean },
): Migration[] {
  return (runGit(root, ['ls-tree', '--name-only', commit, '--', `${folder}/`]) ?? '')
    .split('\n')
    .filter((entry) => entry !== '')
    .map((entry) => path.posix.basename(entry))
    .flatMap((entry): Migration[] => {
      if (directories) {
        return entry.includes('.') ? [] : [{ name: entry, file: `${folder}/${entry}/migration.sql` }];
      }

      const extension = path.posix.extname(entry);

      return SCRIPTS.includes(extension) && !entry.endsWith('.d.ts')
        ? [{ name: entry.slice(0, -extension.length), file: `${folder}/${entry}` }]
        : [];
    })
    .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
}
