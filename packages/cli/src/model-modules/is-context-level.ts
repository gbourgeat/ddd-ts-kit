import { ROLES } from '../check/canonical/roles';
import { isHeldByShared } from './is-held-by-shared';

/**
 * The files a context divided into modules keeps outside every module, by their path relative to
 * the context written without modules: the closed list of its error codes and its permission set
 * (`perContext` of the canonical tree, at the root of the context), and what its `shared/` folder
 * holds (`isHeldByShared`). Every other file of a layer belongs to a module.
 */
export function isContextLevel(context: string, file: string): boolean {
  return (
    isHeldByShared(file) ||
    ROLES.some((role) =>
      (role.perContext ?? []).some((name) => file === `${role.directory}/${name.replace('<context>', context)}`),
    )
  );
}
