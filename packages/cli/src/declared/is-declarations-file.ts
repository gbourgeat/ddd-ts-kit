import { barrelFile } from './barrel-file';
import { DECLARED_ROLES } from './declared-role';
import { moduleSplit } from '../model-modules';

/** The layers role files live in: `application`, `infrastructure`, `presentation`. */
const ROLE_LAYERS = new Set(DECLARED_ROLES.flatMap((role) => role.folders.map((folder) => folder.split('/')[0])));

/**
 * True for a file the generator writes for a declared context assembled by barrel, given relative
 * to the context: the summary at its root, `<context>.declarations.ts`, the declarations of a
 * layer, `<layer>/<layer>.declarations.ts`, or those of a role folder that 0.85 and 0.86 wrote,
 * `<layer>/<folder>/<folder>.declarations.ts`, which the next refresh deletes.
 */
export function isDeclarationsFile(context: string, file: string, modules: readonly string[]): boolean {
  if (file === barrelFile(context)) {
    return true;
  }

  const [layer = '', ...below] = moduleSplit(file, modules).path.split('/');
  const [folder = '', name] = below;

  return (
    ROLE_LAYERS.has(layer) &&
    (name === undefined
      ? folder === `${layer}.declarations.ts`
      : below.length === 2 && name === `${folder}.declarations.ts`)
  );
}
