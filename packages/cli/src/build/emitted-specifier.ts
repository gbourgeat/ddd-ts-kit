import path from 'node:path';
import type { EmittedPlace } from './emitted-place.js';

const DECLARATION = /\.d\.[cm]?ts$/;

/**
 * The relative specifier that names, from an emitted file, the emitted file an alias specifier
 * stands for, with its `.js` extension; nothing when the build emitted no such file. Both files
 * are given from the project root.
 */
export function emittedSpecifier(place: EmittedPlace, file: string, specifier: string): string | undefined {
  const root = place.roots.find(({ prefix }) => specifier.startsWith(prefix));

  if (root === undefined) {
    return undefined;
  }

  const { rootDir, outDir } = place.layout;
  const directory = path.posix.join(outDir, path.posix.relative(rootDir, root.directory));
  const named = path.posix.join(directory, specifier.slice(root.prefix.length));
  const emitted = (candidate: string): boolean => place.isFile(candidate) || declared(place, file, candidate);
  const target = [named, `${named}.js`, `${named}/index.js`].find(emitted);

  if (target === undefined) {
    return undefined;
  }

  const relative = path.posix.relative(path.posix.dirname(file), target);

  return relative.startsWith('.') ? relative : `./${relative}`;
}

/** A declaration file may name a module only its declaration was emitted for. */
function declared(place: EmittedPlace, file: string, candidate: string): boolean {
  return DECLARATION.test(file) && candidate.endsWith('.js') && place.isFile(candidate.replace(/\.js$/, '.d.ts'));
}
