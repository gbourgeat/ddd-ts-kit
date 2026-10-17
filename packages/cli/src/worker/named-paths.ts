/** Past this many paths, a message names the first ones and counts the rest. */
const NAMED_PATHS = 12;

/** Every path when they are few, else the first ones and how many more. */
export function namedPaths(paths: readonly string[]): string {
  const named = paths.slice(0, NAMED_PATHS).join(', ');

  return paths.length > NAMED_PATHS ? `${named} and ${paths.length - NAMED_PATHS} more` : named;
}
