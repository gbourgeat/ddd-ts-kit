import type { AliasRoot } from './alias-root.js';

/**
 * The `paths` of tsconfig.json for these roots: the declaration the compiler, the dev runner, the
 * test runner, knip and dependency-cruiser resolve an alias from. Each target is relative to the
 * tsconfig, which sits at the project root.
 */
export function compilerPaths(roots: readonly AliasRoot[]): Record<string, string[]> {
  return Object.fromEntries(roots.map(({ prefix, directory }) => [`${prefix}*`, [`./${directory}/*`]]));
}
