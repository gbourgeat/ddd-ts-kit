import path from 'node:path';
import type { EmittedPlace } from './emitted-place.js';

/**
 * The emitted file an alias specifier names, from the project root, whether or not it exists;
 * nothing when the specifier starts with no alias. One spelling names it: the path of the file
 * with the ending the project writes, so a directory is never completed with an `index` and a
 * specifier written the other way is never guessed.
 */
export function emittedTarget(place: EmittedPlace, specifier: string): string | undefined {
  const root = place.roots.find(({ prefix }) => specifier.startsWith(prefix));

  if (root === undefined) {
    return undefined;
  }

  const { rootDir, outDir } = place.layout;
  const directory = path.posix.join(outDir, path.posix.relative(rootDir, root.directory));
  const named = path.posix.join(directory, specifier.slice(root.prefix.length));

  return place.suffix === '' ? `${named}.js` : named;
}
