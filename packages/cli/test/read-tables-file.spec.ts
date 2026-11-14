import { beforeAll, describe, expect, it } from 'vitest';
import { type Config, readConfig } from '../src/config';
import { readTablesFile } from '../src/generate/kinds/same-name/read-tables-file';
import { sourcesOf } from '../src/generate/kinds/same-name/sources-of';
import { initProject } from './support/init-project';

let config: Config;

beforeAll(() => {
  config = readConfig(initProject('--orm', 'drizzle', '--context', 'billing:core')).config;
});

/** What a file exports among these files, read through the resolver of a project. */
function exportsOf(files: Readonly<Record<string, string>>, file = 'tables.ts'): ReturnType<typeof readTablesFile> {
  return readTablesFile(
    sourcesOf(config, (asked) => files[asked]),
    file,
  );
}

/** What `tables.ts` exports among these files, each symbol as `<name> <kind> <origin>`. */
function symbolsOf(files: Readonly<Record<string, string>>): { symbols: string[]; unread: readonly string[] } {
  const { symbols, unread } = exportsOf(files);

  return { symbols: symbols.map(({ name, kind, origin }) => `${name} ${kind} ${origin}`), unread };
}

/** Reads `tables.ts` among these files: the names it exports, those that are types and no value, and why it is not read. */
function read(files: Readonly<Record<string, string>>): {
  names: string[];
  types: string[];
  unread: readonly string[];
} {
  const { symbols, unread } = exportsOf(files);
  const names = [...new Set(symbols.map(({ name }) => name))];
  const isValue = (name: string): boolean => symbols.some((symbol) => symbol.name === name && symbol.kind === 'value');

  return { names, types: names.filter((name) => !isValue(name)), unread };
}

describe('the names a tables file exports, read with certainty or not at all', () => {
  it('reads one name per declaration, the names of a list and of a list taken from a file, comments left out', () => {
    const tables = [
      "export const orders = schema.table('orders', { id: text('id') }, (table) => [index().on(table.id, table.at)]);",
      'export  const parcels = 1;',
      '  export const\n  crates = 2;',
      'export function ordersOf() {}',
      'const held = 3;',
      'export { held, held as kept, type Row };',
      "export { invoices as bills, type Line } from './invoices';",
      '// export default 4;',
      'export const last = 5',
    ].join('\n');

    expect(
      read({ 'tables.ts': tables, 'invoices.ts': 'export const invoices = 1;\nexport type Line = string;\n' }),
    ).toEqual({
      names: ['orders', 'parcels', 'crates', 'ordersOf', 'held', 'kept', 'last', 'Row', 'bills', 'Line'],
      types: ['Row', 'Line'],
      unread: [],
    });
  });

  it('follows the files beside it that it re-exports whole, each once, a circle included', () => {
    const files = {
      'tables.ts': "export * from './more.js';\nexport * from './folder';\n",
      'more.ts': "export const orders = 1;\nexport * from './tables';\n",
      'folder/index.ts': 'export const parcels = 1;\n',
    };

    expect(read(files)).toEqual({ names: ['orders', 'parcels'], types: [], unread: [] });
  });

  it.each([
    ['a second name in one statement', 'export const lines = 1, orders = 2;'],
    ['a pattern', 'export const { orders } = tables;'],
    ['a type that holds a comma', 'export const orders: Map<string, number> = held;'],
    ['a default', 'export default orders;'],
    ['a module exported as a name', "export * as tables from './more';"],
    ['a list that is no list of names', 'export { orders as };'],
  ])('answers for every export: %s makes the file unread', (_what, statement) => {
    expect(read({ 'tables.ts': `export const parcels = 1;\n${statement}\n`, 'more.ts': '' }).unread).toEqual([
      expect.stringContaining('tables.ts, line 2'),
    ]);
  });

  it.each([
    ['the alias of the project', "export * from '@/shared/tables';"],
    ['a file that is missing', "export * from './missing';"],
  ])('does not follow %s, and says so', (_what, statement) => {
    expect(read({ 'tables.ts': statement }).unread).toEqual([
      expect.stringContaining('a module the kit does not follow'),
    ]);
  });

  it('stops after a few files, and says a file that is missing', () => {
    const chain = Object.fromEntries(
      Array.from({ length: 12 }, (_, at) => [
        `${at === 0 ? 'tables' : `file${at}`}.ts`,
        `export * from './file${at + 1}';\n`,
      ]),
    );

    expect(read({ ...chain, 'file12.ts': 'export const orders = 1;\n' })).toEqual({
      names: [],
      types: [],
      unread: [expect.stringContaining('a module the kit does not follow')],
    });

    expect(read({})).toEqual({ names: [], types: [], unread: ['tables.ts is missing'] });
  });
});

describe('a tables file whose names are types, or that the reader may misread', () => {
  it.each([
    ['a type alias', 'export type Row = { id: string };', ['Row']],
    ['an interface', 'export interface Row { id: string }', ['Row']],
    ['a declared type', 'export declare type Row = string;', ['Row']],
    ['a list of types', 'type Held = string;\nexport type { Held as Row };', ['Row']],
    ['a type marked in a list', 'type Held = string;\nexport { type Held as Row };', ['Row']],
    ['a type listed after its declaration', 'interface Row { id: string }\nexport { Row };', ['Row']],
    ['a type taken from a file beside it', "export { Row } from './more';", ['Row']],
    ['a value listed after its declaration', 'const Row = 1;\nexport { Row };', []],
    ['a class', 'export class Row {}', []],
    ['an enum', 'export enum Row { One }', []],
  ])('tells a type from a value: %s', (_what, statement, types) => {
    const files = { 'tables.ts': `${statement}\n`, 'more.ts': 'export type Row = string;\n' };

    expect(read(files)).toEqual({ names: ['Row'], types, unread: [] });
  });

  it.each([
    ['a name listed that the file declares as neither', 'export { Row };'],
    ['a constant declared without a value', 'export declare const Row: string;'],
    ['a function declared without a body', 'export declare function Row(): void;'],
    ['a name declared in a function alone', 'function held() {\n  const Row = 1;\n  return Row;\n}\nexport { Row };'],
    ['a constant declared without a value, then listed', 'declare const Row: string;\nexport { Row };'],
    ['a name declared by a loop alone', 'for (const Row of []) {\n  void Row;\n}\nexport { Row };'],
    ['a module re-exported whole that the kit does not find', "export * from './rows.mjs';"],
    ['a module re-exported whole that is a folder and a file at once', "export * from './both';"],
    ['two modules re-exported whole that bring the name', "export * from './more';\nexport * from './other';"],
    ['a name taken from a file that does not export it', "export { Row } from './more';"],
    ['a namespace that holds an export', 'export const Row = 1;\nnamespace Held { export const other = 1; }'],
    ['a declared namespace', 'export const Row = 1;\ndeclare namespace Held { export const other: number; }'],
    ['a declared module', "export const Row = 1;\ndeclare module 'held' { export const other: number; }"],
  ])('leaves the file unread when it cannot tell: %s', (_what, statement) => {
    const files = {
      'tables.ts': `${statement}\n`,
      'more.ts': 'export const other = 1;\n',
      'other.ts': 'export const other = 2;\n',
      'rows.mts': 'export const Row = 1;\n',
      'both.ts': 'export const Row = 1;\n',
      'both/index.ts': 'export const Row = 2;\n',
    };

    expect(read(files).unread).toHaveLength(1);
  });

  it.each([
    ['a function whose name holds a letter of no ASCII word', 'export function café() {}'],
    ['a class whose name holds one', 'export class Café {}'],
    ['a constant whose name holds one', 'export const café = 1;'],
    ['a regular expression', 'const held = /orders/;'],
    ['a backtick in a regular expression', 'const held = /`/;'],
    [
      'a division after a non-null assertion, read as a regular expression',
      'const half = w! / 2; const rest = w! / 3;',
    ],
    ['a division after an increment, read as one', 'const half = i++ / 2; const rest = i++ / 3;'],
    ['a template that does not close', 'const held = `orders'],
    ['a template whose expression does not close', 'const held = `${orders'],
  ])('reads nothing with certainty past %s', (_what, statement) => {
    const { unread } = read({ 'tables.ts': `${statement} export const orders = 1;\n` });

    expect(unread.length).toBeGreaterThan(0);
  });

  it.each([
    ['a division after a non-null assertion', 'const half = w! / 2;'],
    ['a division after an increment', 'const half = i++ / 2;'],
    ['a division after a parenthesis', 'const half = (w) / 2;'],
  ])('never loses the export that follows %s on its line', (_what, statement) => {
    const { names, unread } = read({ 'tables.ts': `${statement} export const orders = 1;\n` });

    expect(unread.length > 0 || names.includes('orders')).toBe(true);
  });
});

describe('what a tables file exports, each with the place that declares it', () => {
  it.each([
    ['a table and the type of its rows', 'export const invoices = 1;\nexport type invoices = string;'],
    ['a class and an interface', 'export class invoices {}\nexport interface invoices { id: string }'],
    ['both, declared then listed', 'const invoices = 1;\ntype invoices = string;\nexport { invoices };'],
  ])('reads a name declared as a value and as a type as both: %s', (_what, statements) => {
    expect(symbolsOf({ 'tables.ts': `${statements}\n` })).toEqual({
      symbols: ['invoices value tables.ts#invoices', 'invoices type tables.ts#invoices'],
      unread: [],
    });
  });

  it('keeps the origin of what it re-exports, whole or by name, however the file is named', () => {
    const files = {
      'src/a/tables.ts': "export * from '../shared';\nexport { currency as money, type Code } from '@/shared/index';\n",
      'src/b/tables.ts': "export { currency } from '../shared/index.js';\nexport * from '@/shared';\n",
      'src/shared/index.ts': 'export const currency = 1;\nexport type Code = string;\n',
    };

    const symbols = (file: string): string[] =>
      exportsOf(files, file).symbols.map(({ name, kind, origin }) => `${name} ${kind} ${origin}`);

    expect(symbols('src/a/tables.ts')).toEqual([
      'money value src/shared/index.ts#currency',
      'Code type src/shared/index.ts#Code',
      'currency value src/shared/index.ts#currency',
    ]);

    expect(symbols('src/b/tables.ts')).toEqual([
      'currency value src/shared/index.ts#currency',
      'Code type src/shared/index.ts#Code',
    ]);
  });

  it('reads a name taken by name from a package as that name of that package, and one imported then listed as the name of its module', () => {
    const files = {
      'tables.ts': [
        "export { auditColumns, type Audited } from '@ddd-ts-kit/drizzle/postgres';",
        "import { orders, type Row } from '@/legacy/tables';",
        'export { orders, Row };',
      ].join('\n'),
      'src/legacy/tables.ts': 'export const orders = 1;\nexport type Row = string;\n',
    };

    expect(symbolsOf(files)).toEqual({
      symbols: [
        'auditColumns value @ddd-ts-kit/drizzle/postgres#auditColumns',
        'Audited type @ddd-ts-kit/drizzle/postgres#Audited',
        'orders value src/legacy/tables.ts#orders',
        'Row type src/legacy/tables.ts#Row',
      ],
      unread: [],
    });
  });

  it('lets what the file declares or takes by name win over what a module re-exported whole brings, and never brings `default`', () => {
    const files = {
      'tables.ts':
        "export const parcels = 1;\nexport type orders = string;\nexport * from './more';\nexport { held as default } from './more';\n",
      'more.ts': 'export const parcels = 2;\nexport const orders = 3;\nexport const held = 4;\n',
    };

    expect(symbolsOf(files)).toEqual({
      symbols: ['parcels value tables.ts#parcels', 'orders type tables.ts#orders', 'held value more.ts#held'],
      unread: [],
    });
  });
});

describe('what a tables file names, resolved the one way', () => {
  it('reads a name taken by name from a module it does not find as a name of this file: the name and its kind are written here', () => {
    const files = {
      'tables.ts':
        "export { Row, type Shape } from './rows.mjs';\nexport { default as seed } from './seed.json';\nexport { other } from '@/shared/none';\n",
      'rows.mts': 'export const Row = 1;\n',
    };

    expect(symbolsOf(files)).toEqual({
      symbols: [
        'Row value tables.ts#Row',
        'Shape type tables.ts#Shape',
        'seed value tables.ts#seed',
        'other value tables.ts#other',
      ],
      unread: [],
    });
  });

  it.each([
    [
      'a file and a folder of one name',
      { 'src/x.ts': 'export const a = 1;\n', 'src/x/index.ts': 'export const a = 2;\n' },
      './x',
      undefined,
    ],
    ['a declaration file beside the folder', { 'src/x.d.ts': '', 'src/x/index.ts': '' }, './x', undefined],
    ['a .tsx beside the folder', { 'src/x.tsx': '', 'src/x/index.ts': '' }, './x', undefined],
    ['a .js beside the .ts', { 'src/x.ts': '', 'src/x.js': '' }, './x', undefined],
    ['a folder that holds a package.json', { 'src/x/index.ts': '', 'src/x/package.json': '{}' }, './x', undefined],
    ['an index of another ending beside it', { 'src/x/index.ts': '', 'src/x/index.mts': '' }, './x', undefined],
    ['the folder itself, a file of its name beside it', { 'src.ts': '', 'src/index.ts': '' }, '.', 'src/index.ts'],
    ['the folder above', { 'src/index.ts': '', 'src.ts': '' }, '../src/', 'src/index.ts'],
    ['a folder named with a slash', { 'src/x.ts': '', 'src/x/index.ts': '' }, './x/', 'src/x/index.ts'],
    ['a file alone', { 'src/x.ts': '' }, './x', 'src/x.ts'],
    ['a file named with its .js ending', { 'src/x.ts': '' }, './x.js', 'src/x.ts'],
    ['a folder alone', { 'src/x/index.ts': '' }, './x', 'src/x/index.ts'],
    ['a file through the alias', { 'src/x.ts': '' }, '@/x', 'src/x.ts'],
  ] as const)(
    'resolves as the compiler does, or not at all: %s',
    (_what, files: Readonly<Record<string, string>>, specifier, path) => {
      const resolved = sourcesOf(config, (asked) => files[asked]).resolve('src/from.ts', specifier);

      expect(resolved).toEqual(path === undefined ? { kind: 'unresolved' } : { kind: 'file', path });
    },
  );

  it('reads the type alone of a value taken as a type', () => {
    const files = { 'tables.ts': "export type { orders } from './more';\n", 'more.ts': 'export const orders = 1;\n' };

    expect(symbolsOf(files).symbols).toEqual(['orders type more.ts#orders']);
  });
});
