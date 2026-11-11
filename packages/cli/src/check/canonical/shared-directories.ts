import { SHARED_OPEN_DIRECTORIES } from './open-directories';
import { ROLES } from './roles';

/** The directories `shared/` of a context divided into modules holds files in, relative to it: its role directories, and its open ones. */
export const SHARED_DIRECTORIES: readonly string[] = [
  ...ROLES.filter((role) => role.shared === true).map((role) => role.directory),
  ...SHARED_OPEN_DIRECTORIES,
];
