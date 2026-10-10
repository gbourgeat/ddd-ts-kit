import type { AliasRoot } from './alias-root.js';

const SPECIAL = /[.*+?^${}()|[\]\\]/g;

/**
 * The `moduleNameMapper` of jest for these roots, which does not read tsconfig: an alias specifier,
 * written with the `.js` extension of the compiled file, answers the TypeScript source.
 */
export function moduleNameMapper(roots: readonly AliasRoot[]): Record<string, string> {
  return Object.fromEntries(
    roots.map(({ prefix, directory }) => [
      String.raw`^${prefix.replace(SPECIAL, String.raw`\$&`)}(.*)\.js$`,
      `<rootDir>/${directory}/$1.ts`,
    ]),
  );
}
