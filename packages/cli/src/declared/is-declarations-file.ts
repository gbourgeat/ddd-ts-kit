import path from 'node:path';
import { barrelFile } from './barrel-file';
import { DECLARED_ROLES } from './declared-role';
import { folderDeclarationsFile } from './folder-declarations-file';
import { moduleSplit } from '../model-modules';

/** The layers role files live in: `application`, `infrastructure`, `presentation`. */
const ROLE_LAYERS = new Set(DECLARED_ROLES.flatMap((role) => role.folders.map((folder) => folder.split('/')[0])));

/**
 * True for a file the generator writes for a declared context assembled by barrel, given relative
 * to the context: the summary at its root, `<context>.declarations.ts`, or the declarations of a
 * role folder, `<layer>/<folder>/<folder>.declarations.ts` or `<layer>/<layer>.declarations.ts`.
 */
export function isDeclarationsFile(context: string, file: string, modules: readonly string[]): boolean {
  if (file === barrelFile(context)) {
    return true;
  }

  const folder = path.posix.dirname(file);

  const [layer = '', ...deeper] = moduleSplit(`${folder}/`, modules)
    .path.split('/')
    .filter((part) => part !== '');

  return ROLE_LAYERS.has(layer) && deeper.length <= 1 && file === folderDeclarationsFile(folder);
}
