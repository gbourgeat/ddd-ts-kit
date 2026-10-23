import path from 'node:path';
import type { EmittedPlace } from './emitted-place';
import { emittedTarget } from './emitted-target';

const DECLARATION = /\.d\.[cm]?ts$/;

/**
 * The relative specifier that names, from an emitted file, the emitted file an alias specifier
 * stands for, always with its `.js` extension: Node resolves no other spelling. A directory is
 * completed with its `index` when no file bears its name. Nothing when the build emitted no such
 * file, or when the specifier is not written as the project writes its imports. Both files are
 * given from the project root.
 */
export function emittedSpecifier(place: EmittedPlace, file: string, specifier: string): string | undefined {
  const target = candidates(place, specifier).find(
    (candidate) => place.isFile(candidate) || declared(place, file, candidate),
  );

  if (target === undefined) {
    return undefined;
  }

  const relative = path.posix.relative(path.posix.dirname(file), target);

  return relative.startsWith('.') ? relative : `./${relative}`;
}

/**
 * The files a specifier can stand for: the file of that name, then, in a project that writes no
 * extension, the `index` of the directory of that name, as the compiler resolves it.
 */
function candidates(place: EmittedPlace, specifier: string): string[] {
  const own = emittedTarget(place, specifier);
  const inside = place.suffix === '' ? emittedTarget(place, `${specifier.replace(/\/$/, '')}/index`) : undefined;

  return [own, inside].filter((candidate) => candidate !== undefined);
}

/** A declaration file may name a module only its declaration was emitted for. */
function declared(place: EmittedPlace, file: string, candidate: string): boolean {
  return DECLARATION.test(file) && candidate.endsWith('.js') && place.isFile(candidate.replace(/\.js$/, '.d.ts'));
}
