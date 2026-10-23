import { ROLES } from '../check/canonical/roles';

/** What a context divided into modules keeps at its own level, read without modules, besides the files of `perContext`. */
const SHARED_BY_THE_MODULES: readonly RegExp[] = [
  // The database of the context: its schema, its tables and its migrations; a row schema is of a module.
  /^infrastructure\/persistence\/(?![^/]*-row\.schema\.ts$)[^/]+\.schema\.ts$/,
  // The route groups, their guards and the shapes several routes answer with.
  /^presentation\/http\/[^/]+\.routes\.ts$/,
  /^presentation\/http\/(?:shared|guards)\//,
  // What the specs of several modules share.
  /^test\/(?:fakes|builders|worlds)\//,
];

/**
 * The files a context keeps at its own level once it is divided into modules, by their path
 * relative to the context written without modules: the closed list of its error codes and its
 * permission set (`perContext` of the canonical tree, at the root of the context), the schema,
 * tables and migrations of its database, its route groups with their guards and shared shapes,
 * and the fakes, builders and worlds of its specs. Every other file of a layer belongs to a module.
 */
export function isContextLevel(context: string, file: string): boolean {
  return (
    SHARED_BY_THE_MODULES.some((pattern) => pattern.test(file)) ||
    ROLES.some((role) =>
      (role.perContext ?? []).some((name) => file === `${role.directory}/${name.replace('<context>', context)}`),
    )
  );
}
