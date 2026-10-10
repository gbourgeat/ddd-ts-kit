import type { AliasRoot } from './alias-root.js';

/**
 * The trees next to the source root, each under a prefix of its own that the config does not
 * rename. `$` is not allowed in the name of a package, so none of them can ever name a dependency.
 */
export const FIXED_ALIAS_ROOTS = {
  test: { prefix: '$test/', directory: 'test' },
  scripts: { prefix: '$scripts/', directory: 'scripts' },
  generated: { prefix: '$generated/', directory: 'generated' },
} as const satisfies Readonly<Record<string, AliasRoot>>;
