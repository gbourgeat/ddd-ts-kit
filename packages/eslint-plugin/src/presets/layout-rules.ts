import type { TSESLint } from '@typescript-eslint/utils';

type Rules = TSESLint.FlatConfig.Rules;

const BLOCKS = ['if', 'for', 'while', 'do', 'try', 'switch', 'block-like'];
const DECLARATIONS = ['const', 'let', 'var'];
const MULTILINE = ['multiline-const', 'multiline-let', 'multiline-var', 'multiline-expression'];
const ONE_LINE_IF = { selector: 'IfStatement', lineMode: 'singleline' };

const PADDING = [
  { blankLine: 'always', prev: '*', next: 'return' },
  { blankLine: 'always', prev: DECLARATIONS, next: '*' },
  { blankLine: 'any', prev: DECLARATIONS, next: DECLARATIONS },
  { blankLine: 'always', prev: '*', next: BLOCKS },
  { blankLine: 'always', prev: BLOCKS, next: '*' },
  { blankLine: 'always', prev: '*', next: MULTILINE },
  { blankLine: 'always', prev: MULTILINE, next: '*' },
  { blankLine: 'any', prev: ['case', 'default'], next: ['case', 'default'] },
  // Consecutive one-line guard clauses may stay together.
  { blankLine: 'any', prev: ONE_LINE_IF, next: ONE_LINE_IF },
];

const CLASS_MEMBERS = {
  // Consecutive fields may stay together; a method is set apart.
  enforce: [
    { blankLine: 'always', prev: '*', next: 'method' },
    { blankLine: 'always', prev: 'method', next: '*' },
  ],
};

/**
 * `clean/blank-lines` of docs/ARCHITECTURE.md, held by four rules of `@stylistic/eslint-plugin`
 * instead of a rule written a second time: a blank line before every `return` that is not
 * alone in its block and between the logical blocks of a function, none at the edges of a
 * block, never two in a row.
 */
export function layoutRules(level: 'error' | 'warn'): Rules {
  return {
    '@stylistic/padding-line-between-statements': [level, ...PADDING],
    '@stylistic/lines-between-class-members': [level, CLASS_MEMBERS, { exceptAfterOverload: true }],
    '@stylistic/padded-blocks': [level, 'never'],
    '@stylistic/no-multiple-empty-lines': [level, { max: 1, maxBOF: 0, maxEOF: 0 }],
  };
}
