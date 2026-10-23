import type { EmittedPlace } from './emitted-place';
import { emittedTarget } from './emitted-target';

const EXTENSION = /\.(?:[cm]?js|[cm]?ts)$/;

/** Why an alias specifier names no emitted file, in the words of what to write instead. */
export function unresolvedProblem(place: EmittedPlace, specifier: string): string {
  const bare = specifier.replace(EXTENSION, '');
  const stem = (emittedTarget({ ...place, suffix: '' }, bare) ?? '').replace(/\.js$/, '');
  const written = bare === specifier ? 'no extension' : 'an extension';

  if (place.suffix !== '' && place.isFile(`${stem}/index.js`)) {
    return `"${specifier}" names a directory: an alias names one file, write "${bare}/index${place.suffix}"`;
  }

  if (place.isFile(`${stem}.js`) && (bare === specifier) !== (place.suffix === '')) {
    return `"${specifier}" has ${written} although "importExtension" is "${place.suffix === '' ? 'none' : 'js'}": write "${bare}${place.suffix}" (\`eslint --fix\` does)`;
  }

  return `"${specifier}" names no file the build emitted`;
}
