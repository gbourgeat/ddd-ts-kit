import stylistic from '@stylistic/eslint-plugin';
import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import { standardRules } from '../../src/index.js';

const linter = new Linter();
const config = [{ files: ['**/*.ts'], languageOptions: { parser: tseslint.parser }, plugins: { '@stylistic': stylistic }, rules: standardRules.layout }];
const findings = (code: string): string[] => linter.verify(code, config, 'sample.ts').map((message) => `${message.ruleId ?? 'parse'}:${message.line}`);
const fixed = (code: string): string => linter.verifyAndFix(code, config, 'sample.ts').output;

describe('the layout rules (clean/blank-lines)', () => {
  it.each([
    ['a return alone in its block', 'function f(): number {\n  return 1;\n}\n'],
    ['a return after a blank line', 'function f(): number {\n  const a = 1;\n\n  return a;\n}\n'],
    ['consecutive declarations', 'const a = 1;\nconst b = 2;\nlet c = 3;\n'],
    ['consecutive one-line guard clauses', 'function f(a: number): number {\n  if (a < 0) return 0;\n  if (a > 9) return 9;\n\n  return a;\n}\n'],
    ['consecutive fields, and a method set apart', 'class A {\n  private readonly a = 1;\n  private readonly b = 2;\n\n  run(): void {}\n\n  stop(): void {}\n}\n'],
    ['consecutive abstract members of a port', 'abstract class P {\n  abstract find(id: string): Promise<void>;\n  abstract save(id: string): Promise<void>;\n  abstract readonly name: string;\n}\n'],
    ['overloads kept together', 'class A {\n  get(a: string): string;\n  get(a: number): number;\n  get(a: unknown): unknown {\n    return a;\n  }\n}\n'],
    ['consecutive case labels', 'switch (a) {\n  case 1:\n  case 2:\n    b();\n    break;\n  default:\n    c();\n}\n'],
  ])('accept %s', (_, code) => {
    expect(findings(code)).toEqual([]);
  });

  it.each([
    ['a return glued to a statement', 'function f(): number {\n  g();\n  return 1;\n}\n', ['@stylistic/padding-line-between-statements:3']],
    ['a statement glued to declarations', 'const a = 1;\ng(a);\n', ['@stylistic/padding-line-between-statements:2']],
    ['a block glued to a statement', 'g();\nif (a) {\n  h();\n}\ng();\n', ['@stylistic/padding-line-between-statements:2', '@stylistic/padding-line-between-statements:5']],
    ['a one-line guard glued to a statement', 'function f(a: number): void {\n  g();\n  if (a < 0) return;\n  g();\n}\n', ['@stylistic/padding-line-between-statements:3', '@stylistic/padding-line-between-statements:4']],
    ['a multiline guard glued to a guard', 'function f(a: number): void {\n  if (a < 0) return;\n  if (a > 9) {\n    return;\n  }\n}\n', ['@stylistic/padding-line-between-statements:3']],
    ['a multiline statement glued to another', 'g();\nh({\n  a: 1,\n});\n', ['@stylistic/padding-line-between-statements:2']],
    ['methods glued together', 'class A {\n  run(): void {}\n  stop(): void {}\n}\n', ['@stylistic/lines-between-class-members:3']],
    ['a method glued to a field', 'class A {\n  private a = 1;\n  run(): void {}\n}\n', ['@stylistic/lines-between-class-members:3']],
    ['a padded block', 'function f(): void {\n\n  g();\n\n}\n', ['@stylistic/padded-blocks:1', '@stylistic/padded-blocks:3']],
    ['two blank lines', 'g();\n\n\ng();\n', ['@stylistic/no-multiple-empty-lines:3']],
  ])('report %s', (_, code, expected) => {
    expect(findings(code)).toEqual(expected);
  });

  it('fix what they report', () => {
    expect(fixed('function f(): number {\n\n  const a = 1;\n  g();\n  return a;\n}\n')).toBe('function f(): number {\n  const a = 1;\n\n  g();\n\n  return a;\n}\n');
  });
});
