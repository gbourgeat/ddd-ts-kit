import type { TSESLint } from '@typescript-eslint/utils';

type Rules = TSESLint.FlatConfig.Rules;

/**
 * `clean/braces` of docs/ARCHITECTURE.md, held by `curly` of ESLint instead of a rule written a
 * second time: every `if`, `else`, `for`, `while` and `do` has braces. Where the braces and the
 * body go is the work of the formatter (`clean/formatted`), which never leaves a body on the
 * line of its braces.
 */
export function bracesRules(level: 'error' | 'warn'): Rules {
  return { curly: [level, 'all'] };
}
