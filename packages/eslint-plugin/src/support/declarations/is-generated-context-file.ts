import type { LintedFile } from '../../project/linted-file';
import { globMatcher } from '../glob-matcher';

/** The layers that hold generated declarations, as `declaredRoleOf` of the CLI places role files. */
const ROLE_LAYERS = ['application', 'infrastructure', 'presentation'];

/**
 * The generated files of a declared context: at its root, `<context>.declarations.ts` and
 * `<context>.dependencies.ts`; in a layer, `<layer>/<layer>.declarations.ts`, or in a role folder
 * as 0.85 and 0.86 wrote them, `<layer>/<folder>/<folder>.declarations.ts`.
 * `declarations/barrel-current` of `ddd-ts-kit check` holds every line of them.
 */
export function isGeneratedContextFile(file: LintedFile): boolean {
  const { contextsDir } = file.config;

  if (globMatcher([`${contextsDir}/*/*.declarations.ts`, `${contextsDir}/*/*.dependencies.ts`])(file.path)) {
    return true;
  }

  // The location leaves the module of the model out: a role folder of a module reads as one of the context.
  if (file.location.area !== 'context') {
    return false;
  }

  const { layer, inside } = file.location;
  const folder = inside.length === 2 ? inside[0] : layer;

  return ROLE_LAYERS.includes(layer) && inside.length <= 2 && inside.at(-1) === `${folder}.declarations.ts`;
}
