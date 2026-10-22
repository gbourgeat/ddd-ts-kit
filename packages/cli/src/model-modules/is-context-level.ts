import { ROLES } from '../check/canonical/roles';

/**
 * The files of `domain/` and `application/` that stay one per context once it is divided into
 * modules, by their path relative to the context, as the canonical tree says (`perContext`): the
 * closed list of its error codes and its permission set.
 */
export function isContextLevel(context: string, file: string): boolean {
  return ROLES.some((role) =>
    (role.perContext ?? []).some((name) => file === `${role.directory}/${name.replace('<context>', context)}`),
  );
}
