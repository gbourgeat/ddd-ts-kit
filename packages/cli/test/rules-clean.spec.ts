import { describe, expect, it } from 'vitest';
import { lines, projectWith, reported } from './rules-support.js';

const FILE = 'src/platform/sample.ts';
const STEPS = (count: number): string[] => Array.from({ length: count }, (_, index) => `  step(${index});`);

describe('clean/function-size, the ceiling of 100 lines', () => {
  it('sees an arrow function, a class property arrow, a function expression and a callback', () => {
    const source = lines(
      'export const charge = async (amount: number): Promise<void> => {',
      ...STEPS(101),
      '};',
      'export class Relay {',
      '  private readonly drain = (): void => {',
      ...STEPS(102),
      '  };',
      '}',
      'export const handler = function (): void {',
      ...STEPS(103),
      '};',
      "describe('the relay', () => {",
      ...STEPS(104),
      '});',
      "it('relays', async function () {",
      ...STEPS(105),
      '});',
    );

    expect(ceiling({ [FILE]: source })).toEqual([
      '1 charge is 101 lines long: no function is longer than 100 lines.',
      '105 drain is 102 lines long: no function is longer than 100 lines.',
      '210 A function expression is 103 lines long: no function is longer than 100 lines.',
      '315 The callback given to describe is 104 lines long: no function is longer than 100 lines.',
      '421 A function expression is 105 lines long: no function is longer than 100 lines.',
    ]);
  });

  it('counts the lines of an arrow that answers with an expression, and of a function nested in another', () => {
    const table = lines('export const rows = (): number[] => [', ...Array.from({ length: 101 }, (_, index) => `  ${index},`), '];');
    const nested = lines('export function outer(): void {', '  function inner(): void {', ...STEPS(101), '  }', '', '  inner();', '}');

    expect(ceiling({ [FILE]: table, 'src/platform/outer.ts': nested })).toEqual([
      '1 outer is 104 lines long: no function is longer than 100 lines.',
      '2 inner is 101 lines long: no function is longer than 100 lines.',
      '1 rows is 103 lines long: no function is longer than 100 lines.',
    ]);
  });

  it('counts code only, stops at 100 lines, and ends a one-line arrow where its line ends', () => {
    const commented = lines('export const charge = (): void => {', ...STEPS(100), '', ...Array.from({ length: 30 }, () => '  // why this step exists'), '};');
    const withoutSemicolons = lines('export const first = () => step(0)', ...Array.from({ length: 150 }, (_, index) => `const value${index} = ${index}`));
    const chained = lines('export const second = (): number =>', '  steps', ...Array.from({ length: 30 }, () => '    .next()'), '    .length;');

    expect(ceiling({ [FILE]: commented, 'src/platform/first.ts': withoutSemicolons, 'src/platform/second.ts': chained })).toEqual([]);
  });

  it('holds in a spec file and in the module file of a context, as an error', () => {
    const suite = lines("describe('billing', () => {", ...STEPS(101), '});');
    const root = projectWith({ 'src/contexts/billing/test/unit/invoice.aggregate.spec.ts': suite, 'src/contexts/billing/billing.module.ts': lines('export const billingModule = defineModule((builder) => {', ...STEPS(101), '});') });

    expect(reported(root, 'clean/function-size').map(({ file, line }) => `${file}:${line}`)).toEqual(['src/contexts/billing/billing.module.ts:1', 'src/contexts/billing/test/unit/invoice.aggregate.spec.ts:1']);
  });
});

describe('clean/blank-lines, what is not a block of statements', () => {
  it('accepts a blank line at the edge of an object, array or type literal, an interface, an enum and a list of names', () => {
    const source = lines(
      "import {", '', '  a,', "} from './a.js';", '',
      'export const table = {', '', '  nested: {', '    a,', '', '  },', '', '};', '',
      'export const list = [', '', '  a,', '', '];', '',
      'export type Row = {', '', '  readonly id: string;', '', '};', '',
      'export interface Options<Name extends string = string> {', '', '  readonly name: Name;', '', '}', '',
      'export enum Level {', '', '  Low,', '', '}', '',
      'export function made(): {', '', '  id: string;', '} {', "  return { id: '' };", '}', '',
      'send({', '', '  a,', '});',
    );

    expect(layout(source)).toEqual([]);
  });

  it('still reports a padded function, method, class, arrow, branch, switch and case block', () => {
    const source = lines(
      'export class Relay {', '', '  run(): void {', '', '    step(0);', '  }', '}', '',
      'export const drain = async (): Promise<number[]> => {', '', '  if (ready) {', '    step(1);', '', '  } else {', '', '    step(2);', '  }', '',
      '  switch (state) {', '    case 1: {', '', '      step(3);', '    }', '', '  }', '};',
    );

    expect(layout(source)).toEqual(['2 start', '4 start', '10 start', '13 end', '15 start', '21 start', '24 end']);
  });

  it('reads a method named return, and a return that is the whole branch of an if without braces, as ESLint does', () => {
    const source = lines(
      'export interface Cursor {', '  next(): number;', '  return(): number;', '}', '',
      'export const cursor = {', '  next() {},', '  return() {},', '};', '',
      'export function first(values: number[]): number {', '  for (const value of values)', '    return value;', '', '  if (values.length === 0)', '    return 0;', '  else', '    return 1;', '}',
    );

    expect(layout(source)).toEqual([]);
  });
});

describe('clean/one-export-per-file, read as ESLint reads it', () => {
  it('takes an interface of a signature whose type parameters carry a default', () => {
    const page = lines('export interface CursorPageInput<Field extends string = string> {', '  readonly cursor?: Field;', '}', '', 'export function cursorPage<Field extends string = string>(input: CursorPageInput<Field> = {}): string {', '  return String(input.cursor);', '}');

    expect(exportsOf({ 'src/platform/cursor-page.ts': page })).toEqual([]);
  });

  it('takes a union type with the interfaces it joins, type arguments included', () => {
    const request = lines(
      'export interface OffsetPageRequest<Field extends string = string> {', '  readonly sort: Field;', '}', '',
      'export interface CursorPageRequest<Field extends string = string> {', '  readonly sort: Field;', '}', '',
      'export type PageRequest<Field extends string = string> =', '  | OffsetPageRequest<Field>', '  | CursorPageRequest<Field>;',
    );

    expect(exportsOf({ 'src/platform/page-request.ts': request })).toEqual([]);
  });

  it('reads the overloads of a function as one function: its body is what uses the private state', () => {
    const sequence = lines(
      'const counters = new Map<string, number>();', '',
      'export function sequence(name: string): string;', 'export function sequence<T>(name: string, format: (n: number) => T): T;', '',
      'export function sequence(name: string, format?: (n: number) => unknown): unknown {', '  counters.set(name, 1);', '', '  return format?.(1);', '}', '',
      'export function resetSequences(): void {', '  counters.clear();', '}',
    );

    expect(exportsOf({ 'src/platform/sequence.ts': sequence })).toEqual([]);
  });

  it('reads the options interface an overload names, and a function derived from an overloaded one', () => {
    const retry = lines(
      'export interface RetryOptions<Kind extends string = string> {', '  readonly kind: Kind;', '}', '',
      'export function retry(): Advice;', 'export function retry(options: RetryOptions): Advice;', '',
      'export function retry(options?: unknown): Advice {', '  return retryAdvice(options);', '}', '',
      'export function retryAdvice(options: unknown): Advice {', '  return advise(options);', '}',
    );

    expect(exportsOf({ 'src/platform/retry.ts': retry })).toEqual([]);
  });
});

describe('clean/no-commented-out-code, the samples of a JSDoc block', () => {
  it('accepts code shown in a JSDoc block: indented, fenced or under @example', () => {
    const source = lines(
      '/**', ' * The attributes a project names by declaration merging.', ' *', " *     declare module '@ddd-ts-kit/kernel' {", ' *       interface ActorExtensions { readonly department: string }', ' *     }', ' */',
      'export interface ActorExtensions {}', '',
      '/**', ' * Reports every failed run.', ' *', ' *     const options: ExecuteOptions = { onError: reportHttpErrors(errors) };', ' *', ' * ```ts', ' * new Scheduler({ onRun: reportFailedRuns(errors) });', ' * ```', ' * @example', ' * await report(run);', ' */',
      'export const reported = 1;',
    );

    expect(reported(projectWith({ [FILE]: source }), 'clean/no-commented-out-code')).toEqual([]);
  });

  it('still reports code left in a line comment or in a plain block comment', () => {
    const source = lines('// const total = lines.reduce((sum, line) => sum + line.amount, 0);', 'export const kept = 1;', '', '/*', 'if (invoice.issued) {', '  return invoice;', '}', '*/', 'export const other = 2;');

    expect(reported(projectWith({ [FILE]: source }), 'clean/no-commented-out-code').map(({ line }) => line)).toEqual([1, 5]);
  });
});

function ceiling(files: Readonly<Record<string, string>>): string[] {
  return reported(projectWith(files), 'clean/function-size')
    .filter(({ message }) => message.includes('no function is longer'))
    .map(({ line, message }) => `${line} ${message}`);
}

function layout(source: string): string[] {
  return reported(projectWith({ [FILE]: source }), 'clean/blank-lines').map(({ line, message }) => `${line} ${message.includes('return') ? 'return' : message.includes('start') ? 'start' : 'end'}`);
}

function exportsOf(files: Readonly<Record<string, string>>): string[] {
  return reported(projectWith(files), 'clean/one-export-per-file').map(({ file, line, message }) => `${file}:${line} ${message}`);
}
