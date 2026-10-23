import { PERMISSIONS_FILE } from '../context-files';
import type { Name } from '../naming';

/**
 * The file holding the permissions of a context, relative to the context, at its root. A generator
 * reads and writes it where the project holds it (`contextFilePlacement`).
 */
export function permissionsFile(context: Name): string {
  return PERMISSIONS_FILE.root(context.kebab);
}
