import { holdsSharedFiles } from './holds-shared-files';
import { SHARED_DIRECTORIES } from './shared-directories';

/**
 * True when a directory, given relative to `shared/` of a context divided into modules, is one of
 * its closed tree: `shared/` itself, a directory that holds its files, an ancestor of one
 * (`infrastructure`, `test`) or anything below an open one.
 */
export function isSharedDirectory(directory: string): boolean {
  return (
    directory === '' ||
    holdsSharedFiles(directory) ||
    SHARED_DIRECTORIES.some((holding) => holding.startsWith(`${directory}/`))
  );
}
