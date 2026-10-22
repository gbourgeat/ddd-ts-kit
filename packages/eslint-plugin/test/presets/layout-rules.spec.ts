import stylistic from '@stylistic/eslint-plugin';
import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import { standardRules } from '../../src';

const linter = new Linter();

const config = [
  {
    files: ['**/*.ts'],
    languageOptions: { parser: tseslint.parser },
    plugins: { '@stylistic': stylistic },
    rules: standardRules.layout,
  },
];

const findings = (code: string): string[] =>
  linter.verify(code, config, 'sample.ts').map((message) => `${message.ruleId ?? 'parse'}:${message.line}`);

const fixed = (code: string): string => linter.verifyAndFix(code, config, 'sample.ts').output;

describe('the layout rules (clean/blank-lines)', () => {
  it.each([
    ['a return alone in its block', 'function f(): number {\n  return 1;\n}\n'],
    ['a return after a blank line', 'function f(): number {\n  const a = 1;\n\n  return a;\n}\n'],
    ['consecutive declarations', 'const a = 1;\nconst b = 2;\nlet c = 3;\n'],
    [
      'a return alone in the block of a guard',
      'function f(a: number): number {\n  if (a < 0) {\n    return 0;\n  }\n\n  return a;\n}\n',
    ],
    [
      'consecutive fields, and a method set apart',
      'class A {\n  private readonly a = 1;\n  private readonly b = 2;\n\n  run(): void {}\n\n  stop(): void {}\n}\n',
    ],
    [
      'consecutive abstract members of a port',
      'abstract class P {\n  abstract find(id: string): Promise<void>;\n  abstract save(id: string): Promise<void>;\n  abstract readonly name: string;\n}\n',
    ],
    [
      'overloads kept together',
      'class A {\n  get(a: string): string;\n  get(a: number): number;\n  get(a: unknown): unknown {\n    return a;\n  }\n}\n',
    ],
    ['consecutive case labels', 'switch (a) {\n  case 1:\n  case 2:\n    b();\n    break;\n  default:\n    c();\n}\n'],
  ])('accept %s', (_, code) => {
    expect(findings(code)).toEqual([]);
  });

  it.each([
    [
      'a return glued to a statement',
      'function f(): number {\n  g();\n  return 1;\n}\n',
      ['@stylistic/padding-line-between-statements:3'],
    ],
    ['a statement glued to declarations', 'const a = 1;\ng(a);\n', ['@stylistic/padding-line-between-statements:2']],
    [
      'a block glued to a statement',
      'g();\nif (a) {\n  h();\n}\ng();\n',
      ['@stylistic/padding-line-between-statements:2', '@stylistic/padding-line-between-statements:5'],
    ],
    [
      'a guard glued to a statement',
      'function f(a: number): void {\n  g();\n  if (a < 0) {\n    return;\n  }\n  g();\n}\n',
      ['@stylistic/padding-line-between-statements:3', '@stylistic/padding-line-between-statements:6'],
    ],
    [
      'a guard glued to a guard',
      'function f(a: number): void {\n  if (a < 0) {\n    return;\n  }\n  if (a > 9) {\n    return;\n  }\n}\n',
      ['@stylistic/padding-line-between-statements:5'],
    ],
    [
      'a multiline statement glued to another',
      'g();\nh({\n  a: 1,\n});\n',
      ['@stylistic/padding-line-between-statements:2'],
    ],
    [
      'methods glued together',
      'class A {\n  run(): void {}\n  stop(): void {}\n}\n',
      ['@stylistic/lines-between-class-members:3'],
    ],
    [
      'a method glued to a field',
      'class A {\n  private a = 1;\n  run(): void {}\n}\n',
      ['@stylistic/lines-between-class-members:3'],
    ],
  ])('report %s', (_, code, expected) => {
    expect(findings(code)).toEqual(expected);
  });

  it('fix what they report', () => {
    expect(fixed('function f(): number {\n  const a = 1;\n  g();\n  return a;\n}\n')).toBe(
      'function f(): number {\n  const a = 1;\n\n  g();\n\n  return a;\n}\n',
    );
  });

  it('leave the padding of a block and a run of blank lines to the formatter', () => {
    expect(findings('function f(): void {\n\n  g();\n\n}\n\n\ng();\n')).toEqual([]);
  });
});

describe('the braces rule (clean/braces)', () => {
  const braces = [{ files: ['**/*.ts'], languageOptions: { parser: tseslint.parser }, rules: standardRules.braces }];

  const reported = (code: string): string[] =>
    linter.verify(code, braces, 'sample.ts').map((message) => `${message.ruleId ?? 'parse'}:${message.line}`);

  it.each([
    ['a braced branch and its else', 'if (a) {\n  g();\n} else if (b) {\n  h();\n} else {\n  i();\n}\n'],
    ['a braced loop', 'for (const step of steps) {\n  await step();\n}\n'],
    [
      'a ternary, an arrow returning an expression and a one-line object',
      'const f = (a: number) => (a > 0 ? { a } : {});\n',
    ],
  ])('accepts %s', (_, code) => {
    expect(reported(code)).toEqual([]);
  });

  it.each([
    ['an if on one line', 'if (a) g();\n', ['curly:1']],
    ['an else without braces', 'if (a) {\n  g();\n} else h();\n', ['curly:3']],
    [
      'a for, a while and a do without braces',
      'for (;;) g();\nwhile (a) g();\ndo g();\nwhile (a);\n',
      ['curly:1', 'curly:2', 'curly:3'],
    ],
  ])('reports %s', (_, code, expected) => {
    expect(reported(code)).toEqual(expected);
  });

  it('adds the braces, and leaves where they go to the formatter', () => {
    expect(linter.verifyAndFix('if (a) g();\n', braces, 'sample.ts').output).toBe('if (a) {g();}\n');
  });
});
