import type { AliasRoot } from './alias-root';

const SPECIAL = /[.*+?^${}()|[\]\\]/g;

/** Where jest looks for the source of an alias specifier, in order. */
export type MapperTarget = string | readonly string[];

/**
 * The `moduleNameMapper` of jest for these roots, which does not read tsconfig: an alias
 * specifier, written with `suffix` (the `.js` of the compiled file, or nothing), answers the
 * TypeScript source and nothing else. Without an ending, a specifier can name a directory, whose
 * barrel jest then finds after the file: `$1.ts`, then `$1/index.ts`.
 */
export function moduleNameMapper(roots: readonly AliasRoot[], suffix: string): Record<string, MapperTarget> {
  const ending = suffix.replace(SPECIAL, String.raw`\$&`);

  return Object.fromEntries(
    roots.map(({ prefix, directory }) => [
      `^${prefix.replace(SPECIAL, String.raw`\$&`)}(.*)${ending}$`,
      suffix === ''
        ? [`<rootDir>/${directory}/$1.ts`, `<rootDir>/${directory}/$1/index.ts`]
        : `<rootDir>/${directory}/$1.ts`,
    ]),
  );
}
