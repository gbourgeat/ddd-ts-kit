import { matchesDirectory } from './matches-directory.js';
import { OPEN_DIRECTORIES } from './open-directories.js';
import { ROLES } from './roles.js';

export function isCanonicalDirectory(directory: string): boolean {
  if (OPEN_DIRECTORIES.some((open) => directory === open || directory.startsWith(`${open}/`))) {
    return true;
  }

  if (directory === 'test') {
    return true;
  }

  return ROLES.some((role) => {
    const parts = role.directory.split('/');

    // Every ancestor of a role directory is canonical too (domain/, application/integration/...).
    return parts.some((_, index) => matchesDirectory(parts.slice(0, index + 1).join('/'), directory));
  });
}
