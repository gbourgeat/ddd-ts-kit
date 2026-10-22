import { DECLARED_ROLES, type DeclaredRole } from './declared-role.js';
import { moduleSplit } from '../model-modules/index.js';

/**
 * The role of a source given relative to its context, or undefined when the file plays none.
 * `modules` are the modules of the model the context declares, in which the file may sit; none
 * for a path already read without its module.
 */
export function declaredRoleOf(inModule: string, modules: readonly string[]): DeclaredRole | undefined {
  const file = moduleSplit(inModule, modules).path;

  if (!file.endsWith('.ts') || file.endsWith('.d.ts') || file.endsWith('.spec.ts')) {
    return undefined;
  }

  const stem = file.slice(0, -'.ts'.length);

  return DECLARED_ROLES.find(
    (role) => stem.endsWith(`.${role.suffix}`) && role.folders.some((folder) => file.startsWith(`${folder}/`)),
  );
}
