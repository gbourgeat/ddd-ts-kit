import { SHARED_OPEN_DIRECTORIES } from './open-directories';
import { SHARED_DIRECTORIES } from './shared-directories';

/** True when a source may sit directly in a directory given relative to `shared/` of a context divided into modules. */
export function holdsSharedFiles(directory: string): boolean {
  return (
    SHARED_DIRECTORIES.includes(directory) || SHARED_OPEN_DIRECTORIES.some((open) => directory.startsWith(`${open}/`))
  );
}
