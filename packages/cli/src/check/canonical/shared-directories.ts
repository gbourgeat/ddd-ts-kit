import { OPEN_DIRECTORIES } from './open-directories';
import { ROLES } from './roles';

/** The directories `shared/` of a context divided into modules holds files in, relative to it: its role directories, and the open ones of its tests: what the specs of several modules share, and the specs of what it holds (a guard) or of several modules. */
export const SHARED_DIRECTORIES: readonly string[] = [
  ...ROLES.filter((role) => role.shared === true).map((role) => role.directory),
  ...OPEN_DIRECTORIES,
];
