import { matchesDirectory } from './matches-directory';
import type { Role } from './role';
import { ROLES } from './roles';

/** The role of a directory given relative to its context, if it is a role directory. */
export function roleOf(directory: string): Role | undefined {
  return ROLES.find((role) => matchesDirectory(role.directory, directory));
}
