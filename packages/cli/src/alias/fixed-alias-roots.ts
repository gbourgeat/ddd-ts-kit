import type { AliasRoot } from './alias-root.js';

/** The trees next to the source root, each under a prefix of its own that the config does not rename. */
export const FIXED_ALIAS_ROOTS = {
  test: { prefix: '#test/', directory: 'test', compiled: false },
  scripts: { prefix: '#scripts/', directory: 'scripts', compiled: true },
  generated: { prefix: '#generated/', directory: 'generated', compiled: true },
} as const satisfies Readonly<Record<string, AliasRoot>>;
