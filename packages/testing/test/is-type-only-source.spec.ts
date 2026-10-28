import { describe, expect, it } from 'vitest';
import { isTypeOnlySource } from '../src/coverage/is-type-only-source';

describe('isTypeOnlySource(), a file whose compiled form holds no statement', () => {
  it.each([
    ['interfaces and aliases', 'export interface A {\n  readonly id: string;\n}\nexport type B = A | undefined;\n'],
    [
      'a type import and a type re-export',
      "import type { A } from './a';\nexport type { A } from './a';\nexport type * from './b';\n",
    ],
    ['an alias over several lines', "export type Status =\n  | 'open'\n  | 'closed';\n"],
    ['an alias of an object type, then another', 'export type A = {\n  a: 1;\n} & B\nexport type B = { b: 2 };\n'],
    ['an interface that extends', 'export interface A\n  extends B {\n  const: string;\n}\n'],
    [
      'comments and strings that look like code',
      "// const x = 1;\n/* function f() {} */\nexport type A = { 'const x = (': 1 };\n",
    ],
    ['an interface of the kind declared', 'declare interface A {}\nexport default interface B {}\n'],
  ])('reads %s as types only', (_, source) => {
    expect(isTypeOnlySource(source)).toBe(true);
  });

  it.each([
    ['a constant beside a type', 'export interface A {}\nexport const a = 1;\n'],
    ['a function', 'export type A = string;\nexport function f(): A {\n  return "a";\n}\n'],
    ['a class', 'export abstract class A {}\n'],
    ['an enum', 'export enum A {\n  X,\n}\n'],
    ['a value re-export', "export { a } from './a';\nexport * from './b';\n"],
    ['a side effect import', "import './polyfill';\nexport type A = string;\n"],
    ['a statement after an alias', 'export type A = string\nconsole.log(1);\n'],
    ['a decorator', 'export type A = string;\n@Injectable()\nclass B {}\n'],
    ['an empty file', ''],
    ['comments only', '// nothing\n'],
  ])('reads %s as runtime code', (_, source) => {
    expect(isTypeOnlySource(source)).toBe(false);
  });
});
