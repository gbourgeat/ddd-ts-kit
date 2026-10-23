import { describe, expect, it } from 'vitest';
import { OTHER_LANGUAGE_FIXTURES } from '../src/check/fixtures/other-language-fixtures';
import { typeDeclarations } from '../src/check/language/type-declarations';
import { typeRoot } from '../src/check/language/type-root';
import { typedByOtherLanguage } from '../src/check/language/typed-by-other-language';
import { scan } from '../src/check/scan/scan';
import { checkJsonOf } from './check-support';
import { cli, tempDir, write } from './helpers';

const OTHER = new Map([
  ['Payload', 'catalog/published-language'],
  ['ErpState', '"legacy-erp"'],
  ['states', 'this file'],
]);

/** Whether the literal `value` (its `nth` occurrence) of `source` is typed by another language. */
function typed(source: string, value: string, nth = 0): boolean {
  const scanned = scan(source);
  const literal = scanned.strings.filter((candidate) => candidate.value === value)[nth];

  if (literal === undefined) {
    throw new Error(`no literal ${value} in ${source}`);
  }

  return typedByOtherLanguage(scanned.code, literal, OTHER);
}

describe('a literal typed by another language', () => {
  it('is a key of a table typed Record<T, ..> by its annotation or by satisfies, wrapped or not', () => {
    expect(typed("const table: Record<Payload['state'], Status> = { 'draft': Status.Draft };", 'draft')).toBe(true);

    expect(
      typed("const t = { 'draft': Status.Draft } as const satisfies Readonly<Record<ErpState, Status>>;", 'draft'),
    ).toBe(true);

    expect(
      typed(
        "class T {\n  private readonly t: Partial<Record<ErpState, Status>> = { 'draft': Status.Draft };\n}",
        'draft',
      ),
    ).toBe(true);

    expect(
      typed("const t: Record<keyof typeof states, Status> = {\n  // first\n  'draft': Status.Draft,\n};", 'draft'),
    ).toBe(true);

    expect(typed("const t: Record<(typeof states)[number], Status> = { a: x, 'draft': y };", 'draft')).toBe(true);
  });

  it('is the whole value of an entry of a table typed Record<.., T>', () => {
    expect(typed("const t: Record<Status, Payload['state']> = { [Status.Draft]: 'draft' };", 'draft')).toBe(true);

    expect(
      typed("const t: Record<Status, Payload['state']> = { [Status.Draft]: flag ? 'draft' : 'issued' };", 'draft'),
    ).toBe(false);

    expect(typed("const t: Record<Status, Payload['state']> = { [Status.Draft]: { at: 'draft' } };", 'draft')).toBe(
      false,
    );

    expect(typed("const t: Record<Payload['state'], Status> = { 'issued': label('draft') };", 'draft')).toBe(false);
  });

  it('is written satisfies T, in a case, a comparison or alone', () => {
    expect(typed("switch (state) {\n  case 'draft' satisfies Payload['state']:\n    break;\n}", 'draft')).toBe(true);
    expect(typed("const issued = state === ('draft' satisfies ErpState) && ready;", 'draft')).toBe(true);
    expect(typed("const issued = state === 'draft' satisfies ErpState || ready;", 'draft')).toBe(true);
    expect(typed("const first = 'draft' satisfies keyof typeof states;", 'draft')).toBe(true);
  });

  it('is not typed by a union, an intersection, an assertion, a type of the context or a name read from elsewhere', () => {
    expect(typed("const t: Record<Payload['state'] | Local, Status> = { 'draft': x };", 'draft')).toBe(false);
    expect(typed("const t: Readonly<Record<ErpState, Status>> & Extra = { 'draft': x };", 'draft')).toBe(false);
    expect(typed("const t = { 'draft': x } as Record<ErpState, Status>;", 'draft')).toBe(false);
    expect(typed("const t: Record<Status, string> = { 'draft': x };", 'draft')).toBe(false);
    expect(typed("const t: Map<ErpState, Status> = { 'draft': x };", 'draft')).toBe(false);
    expect(typed("const first = 'draft' satisfies ErpState | Status;", 'draft')).toBe(false);
    expect(typed("const first = 'draft' satisfies ErpState\n  | Status;", 'draft')).toBe(false);
    expect(typed("const first = 'draft' satisfies Status;", 'draft')).toBe(false);
    expect(typed("const first = 'draft' satisfies ErpState[];", 'draft')).toBe(false);
  });
});

describe('the root of a type written as one reference', () => {
  it('is its first name, through indexed accesses, keyof, typeof, a namespace and type arguments', () => {
    expect(typeRoot("Payload['state']['code']")).toBe('Payload');
    expect(typeRoot('keyof typeof states')).toBe('states');
    expect(typeRoot('(typeof states)[number]')).toBe('states');
    expect(typeRoot('erp.State<A | B>')).toBe('erp');
    expect(typeRoot('A | B')).toBeUndefined();
    expect(typeRoot('A<X> | B<Y>')).toBeUndefined();
    expect(typeRoot("'draft'")).toBeUndefined();
  });
});

describe('the interfaces and type aliases of a file', () => {
  it('span their body, a type alias ending at its semicolon or at its last line', () => {
    const code =
      "interface Wire {\n  state: 'a';\n}\ntype Code = 'a'\n  | 'b'\nexport const c = 1;\nnamespace N {\n  type Inner = 'c';\n}\n";

    const declarations = typeDeclarations(scan(code).code);

    expect(declarations.map(({ name, topLevel }) => [name, topLevel])).toEqual([
      ['Wire', true],
      ['Code', true],
      ['Inner', false],
    ]);

    expect(declarations.map(({ start, end }) => code.slice(start, end))).toEqual([
      "interface Wire {\n  state: 'a';\n}",
      "type Code = 'a'\n  | 'b'",
      "type Inner = 'c'",
    ]);
  });
});

describe('the fix of language/declared-vocabulary', () => {
  /** What `check --json` reports for the vocabulary rule on the files of a fixture. */
  function reported(name: string): { line: number; fix: string }[] {
    const fixture = OTHER_LANGUAGE_FIXTURES.find((candidate) => candidate.name === name);
    const root = tempDir('other-language');

    for (const [file, content] of Object.entries(fixture?.files ?? {})) {
      write(root, file, content);
    }

    return checkJsonOf(cli(root, 'check', '--rule', 'language/declared-vocabulary', '--json')).violations.map(
      ({ line, fix }) => ({ line, fix }),
    );
  }

  it('names the other language a translation file reads, and reports the value of the context only', () => {
    const [value, ...more] = reported('a value of the context in a table keyed by the published payload');

    expect(more).toEqual([]);
    expect(value?.line).toBe(5);

    expect(value?.fix).toContain(
      'If it is a word of another language this file reads (ProductListedV1Payload of catalog/published-language)',
    );

    expect(value?.fix).toContain(
      '`Record<TheirType, InvoiceStatus>` for its keys or `Record<InvoiceStatus, TheirType>` for its values',
    );

    expect(value?.fix).toContain("`'draft' satisfies TheirType`");
  });

  it('keeps the fix of the vocabulary alone in the model, which reads no other language', () => {
    expect(reported('a literal that satisfies a type of a package, in the model')).toEqual([
      {
        line: 3,
        fix: 'Write InvoiceStatus.Issued, as a computed key `[..]:` for a key: the value is declared once, the editor completes it and a typo stops the build.',
      },
    ]);
  });
});
