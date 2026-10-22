import path from 'node:path';
import { barrelFile } from './barrel-file.js';
import { DECLARED_ROLES } from './declared-role.js';
import { folderDeclarationsFile } from './folder-declarations-file.js';
import { moduleSplit } from '../model-modules/index.js';

/** The layers role files live in: `application`, `infrastructure`, `presentation`. */
const ROLE_LAYERS = new Set(DECLARED_ROLES.flatMap((role) => role.folders.map((folder) => folder.split('/')[0])));

/**
 * True for a file the generator writes for a declared context assembled by barrel, given relative
 * to the context: the summary at its root, `<context>.declarations.ts`, or the declarations of a
 * role folder, `<layer>/<folder>/<folder>.declarations.ts` or `<layer>/<layer>.declarations.ts`.
 */
export function isDeclarationsFile(context: string, file: string): boolean {
  if (file === barrelFile(context)) {
    return true;
  }

  const folder = path.posix.dirname(file);

  const [layer = '', ...deeper] = moduleSplit(`${folder}/`)
    .path.split('/')
    .filter((part) => part !== '');

  return ROLE_LAYERS.has(layer) && deeper.length <= 1 && file === folderDeclarationsFile(folder);
}
