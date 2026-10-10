import type { TSESLint } from '@typescript-eslint/utils';

type Rules = TSESLint.FlatConfig.Rules;

const BLOCKS = ['if', 'for', 'while', 'do', 'try', 'switch', 'block-like'];
const DECLARATIONS = ['const', 'let', 'var'];
const MULTILINE = ['multiline-const', 'multiline-let', 'multiline-var', 'multiline-expression'];

const PADDING = [
  { blankLine: 'always', prev: '*', next: 'return' },
  { blankLine: 'always', prev: DECLARATIONS, next: '*' },
  { blankLine: 'any', prev: DECLARATIONS, next: DECLARATIONS },
  { blankLine: 'always', prev: '*', next: BLOCKS },
  { blankLine: 'always', prev: BLOCKS, next: '*' },
  { blankLine: 'always', prev: '*', next: MULTILINE },
  { blankLine: 'always', prev: MULTILINE, next: '*' },
  { blankLine: 'any', prev: ['case', 'default'], next: ['case', 'default'] },
];

const CLASS_MEMBERS = {
  // Consecutive fields may stay together; a method is set apart.
  enforce: [
    { blankLine: 'always', prev: '*', next: 'method' },
    { blankLine: 'always', prev: 'method', next: '*' },
  ],
};

/**
 * `clean/blank-lines` of docs/ARCHITECTURE.md, held by two rules of `@stylistic/eslint-plugin`
 * instead of a rule written a second time: a blank line before every `return` that is not
 * alone in its block, between the logical blocks of a function and around a method. The
 * formatter (`clean/formatted`) holds the rest: none at the edges of a block, never two in a row.
 */
export function layoutRules(level: 'error' | 'warn'): Rules {
  return {
    '@stylistic/padding-line-between-statements': [level, ...PADDING],
    '@stylistic/lines-between-class-members': [level, CLASS_MEMBERS, { exceptAfterOverload: true }],
  };
}
