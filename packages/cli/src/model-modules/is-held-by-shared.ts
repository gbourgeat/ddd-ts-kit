/** What `shared/` of a context divided into modules holds, by its path relative to the context written without `shared/`. */
const HELD_BY_SHARED: readonly RegExp[] = [
  // The database of the context: its schema, its tables and its migrations; a row schema is of a module.
  /^infrastructure\/persistence\/(?![^/]*-row\.schema\.ts$)[^/]+\.schema\.ts$/,
  // The route groups, their guards and the shapes several routes answer with.
  /^presentation\/http\/[^/]+\.routes\.ts$/,
  /^presentation\/http\/(?:shared|guards)\//,
  // The arrangements the specs of several modules share.
  /^test\/worlds\//,
];

/**
 * True for a file that belongs to no module of a context divided into modules, and sits in its
 * `shared/` folder: the schema and tables of its database, its route groups with their guards and
 * shared shapes, and its worlds. A fake or a builder follows its subject into a module; one that
 * has none, and a spec of what `shared/` holds, sit in `shared/test/` too, told by no path.
 */
export function isHeldByShared(file: string): boolean {
  return HELD_BY_SHARED.some((pattern) => pattern.test(file));
}
