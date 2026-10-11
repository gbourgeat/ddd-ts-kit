import path from 'node:path';
import type { EmittedPlace } from './emitted-place.js';
import { emittedTarget } from './emitted-target.js';

const DECLARATION = /\.d\.[cm]?ts$/;

/**
 * The relative specifier that names, from an emitted file, the emitted file an alias specifier
 * stands for, always with its `.js` extension: Node resolves no other spelling. Nothing when the
 * build emitted no such file, or when the specifier is not written as the project writes its
 * imports. Both files are given from the project root.
 */
export function emittedSpecifier(place: EmittedPlace, file: string, specifier: string): string | undefined {
  const target = emittedTarget(place, specifier);

  if (target === undefined || !(place.isFile(target) || declared(place, file, target))) {
    return undefined;
  }

  const relative = path.posix.relative(path.posix.dirname(file), target);

  return relative.startsWith('.') ? relative : `./${relative}`;
}

/** A declaration file may name a module only its declaration was emitted for. */
function declared(place: EmittedPlace, file: string, candidate: string): boolean {
  return DECLARATION.test(file) && candidate.endsWith('.js') && place.isFile(candidate.replace(/\.js$/, '.d.ts'));
}
