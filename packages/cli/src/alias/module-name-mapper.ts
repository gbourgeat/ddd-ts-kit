import type { AliasRoot } from './alias-root.js';

const SPECIAL = /[.*+?^${}()|[\]\\]/g;

/**
 * The `moduleNameMapper` of jest for these roots, which does not read tsconfig: an alias
 * specifier, written with `suffix` (the `.js` of the compiled file, or nothing), answers the
 * TypeScript source and nothing else.
 */
export function moduleNameMapper(roots: readonly AliasRoot[], suffix: string): Record<string, string> {
  const ending = suffix.replace(SPECIAL, String.raw`\$&`);

  return Object.fromEntries(
    roots.map(({ prefix, directory }) => [
      `^${prefix.replace(SPECIAL, String.raw`\$&`)}(.*)${ending}$`,
      `<rootDir>/${directory}/$1.ts`,
    ]),
  );
}
