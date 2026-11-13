import { describe, expect, it } from 'vitest';
import { CONFIG_FILE } from '../src/config';
import { config } from '../src/check/fixtures/config';
import { project } from '../src/check/fixtures/project';
import { runFixture } from '../src/check/fixtures/run-fixture';
import type { Violation } from '../src/check/model/violation';

const RULE = 'persistence/read-model-listed';
const LIST = 'src/platform/database/read-model-tables.ts';
const PERSISTENCE = 'src/contexts/billing/infrastructure/persistence';
const TOTALS = `${PERSISTENCE}/knex-invoice-totals.repository.ts`;
const TOTALS_IMPORT = `import { KnexInvoiceTotals } from '@/contexts/billing/infrastructure/persistence/knex-invoice-totals.repository';`;

/** A store over the store of the kit, with the constructor and the export a case gives it. */
function store(name: string, written: { base?: string; parameters?: string; exported?: string } = {}): string {
  const { base = 'KnexReadModelStore<Total>', parameters = 'context: KnexContext', exported = 'export ' } = written;

  return `${exported}class ${name} extends ${base} {\n  constructor(${parameters}) {\n    super(context, { table: TABLE });\n  }\n}\n`;
}

/** The list, with what a case writes among its imports, between the markers of each array and after them. */
function list(held: { imports?: string; entries?: string; notListed?: string; more?: string } = {}): string {
  return [
    '// ddd-ts-kit:imports',
    ...(held.imports === undefined ? [] : [held.imports]),
    '// /ddd-ts-kit:imports',
    '',
    'const LISTED = [',
    '  // ddd-ts-kit:read-model-tables',
    ...(held.entries === undefined ? [] : [held.entries]),
    '  // /ddd-ts-kit:read-model-tables',
    '];',
    '',
    'const NOT_LISTED = [',
    '  // ddd-ts-kit:read-models-not-listed',
    ...(held.notListed === undefined ? [] : [held.notListed]),
    '  // /ddd-ts-kit:read-models-not-listed',
    '];',
    '',
    'export const readModelTables = { LISTED, NOT_LISTED };',
    ...(held.more === undefined ? [] : ['', held.more]),
    '',
  ].join('\n');
}

/** What the rule reports on a project on Knex that holds these files. */
function reported(files: Readonly<Record<string, string>>): Violation[] {
  const written = project(files, { [CONFIG_FILE]: config({ importExtension: 'none', stack: { orm: 'knex' } }) });
  const { violations } = runFixture({ ruleId: RULE, name: 'a case of the spec', expect: 'pass', files: written });

  return violations.filter((violation) => violation.ruleId === RULE);
}

describe('persistence/read-model-listed: the fix says what to write, and what is written passes', () => {
  it('takes for buildable a constructor on a member type, with modifiers and the scope, and gives its two lines', () => {
    const parameters = "private readonly context: Persistence['database'], protected readonly scope: ExecutionScope";
    const [finding] = reported({ [TOTALS]: store('KnexInvoiceTotals', { parameters }), [LIST]: list() });

    expect(finding?.file).toBe(TOTALS);

    expect(finding?.fix).toContain(
      `add \`${TOTALS_IMPORT}\` to the imports and \`['billing', KnexInvoiceTotals],\` to LISTED`,
    );

    expect(finding?.fix).toContain('write between the markers of LISTED (`// ddd-ts-kit:read-model-tables`) a comment');
  });

  it('gives the entry alone when the list still imports the class, and no alias for a name a comment holds', () => {
    const files = { [TOTALS]: store('KnexInvoiceTotals') };
    const [imported] = reported({ ...files, [LIST]: list({ imports: TOTALS_IMPORT }) });
    const [commented] = reported({ ...files, [LIST]: list({ more: '// KnexInvoiceTotals was listed here' }) });

    expect(imported?.fix).toContain("add `['billing', KnexInvoiceTotals],` to LISTED (`ddd-ts-kit init` writes it)");
    expect(imported?.fix).not.toContain('import {');
    expect(commented?.fix).toContain(`add \`${TOTALS_IMPORT}\` to the imports`);
  });

  it('names what stands in the way of a store the list cannot build, and the constructor it accepts', () => {
    const fixOf = (written: string): string => reported({ [TOTALS]: written, [LIST]: list() })[0]?.fix ?? '';
    const odd = store('KnexInvoiceTotals', { parameters: 'context: KnexContext, readonly size: number' });

    expect(fixOf(odd)).toContain('its own constructor is not the one of a generated store, or is inherited');
    expect(fixOf(odd)).toContain('`(database: <Type>)` or `(database: <Type>, scope: ExecutionScope)`');
    expect(fixOf(odd)).toContain("constructor(database: Persistence['database']) { super(..); }");
    expect(fixOf(store('KnexInvoiceTotals', { exported: '' }))).toContain('its file does not export it');

    for (const written of [
      store('KnexInvoiceTotals', { exported: 'export default ' }),
      `${store('KnexInvoiceTotals', { exported: '' })}\nexport default KnexInvoiceTotals;\n`,
      `${store('KnexInvoiceTotals', { exported: '' })}\nexport { KnexInvoiceTotals as default };\n`,
    ]) {
      expect(fixOf(written)).toContain(
        'it is the default export of its file, and the list imports a store by its name',
      );

      expect(fixOf(written)).not.toContain('import {');
    }
  });

  it('never proposes a class to build the class that was written to build a store', () => {
    const odd = `${PERSISTENCE}/listed-knex-invoice-totals.repository.ts`;
    const builder = store('ListedKnexInvoiceTotals', { base: 'KnexInvoiceTotals', parameters: 'context: Odd' });

    const findings = reported({
      [TOTALS]: store('KnexInvoiceTotals', { parameters: 'context: KnexContext, readonly size: number' }),
      [odd]: builder.replace('constructor(context: Odd)', 'constructor(context: Odd<{ id: string }>)'),
      [LIST]: list({ notListed: "  'billing: KnexInvoiceTotals'," }),
    });

    expect(findings.map(({ file }) => file)).toEqual([odd]);

    expect(findings[0]?.fix).toContain(
      'ListedKnexInvoiceTotals is the class written to build KnexInvoiceTotals: make it',
    );

    expect(findings[0]?.fix).not.toContain('ListedListed');
  });

  it('says of a store under a folder the config does not declare that it is no declared context', () => {
    const ghost = 'src/contexts/ghost/infrastructure/persistence/knex-ghost-totals.repository.ts';
    const [finding] = reported({ [ghost]: store('KnexGhostTotals'), [LIST]: list() });

    expect(finding?.file).toBe(ghost);
    expect(finding?.fix).toContain(`src/contexts/ghost is no context ${CONFIG_FILE} declares`);
    expect(finding?.fix).not.toContain("['ghost'");
  });

  it('reports a line of NOT_LISTED once LISTED answers for its store, and says why', () => {
    const builder = `${PERSISTENCE}/listed-knex-invoice-totals.repository.ts`;

    const [finding] = reported({
      [TOTALS]: store('KnexInvoiceTotals', { parameters: 'context: KnexContext, readonly size: number' }),
      [builder]: store('ListedKnexInvoiceTotals', { base: 'KnexInvoiceTotals' }),
      [LIST]: list({
        imports:
          "import { ListedKnexInvoiceTotals } from '@/contexts/billing/infrastructure/persistence/listed-knex-invoice-totals.repository';",
        entries: "  ['billing', ListedKnexInvoiceTotals],",
        notListed: "  'billing: KnexInvoiceTotals',",
      }),
    });

    expect(finding?.file).toBe(LIST);
    expect(finding?.message).toContain('which an entry of LISTED answers for: the start still warns');
  });
});

describe('persistence/read-model-listed: a barrel answers for the class the entry names, and no other', () => {
  const barrel = `${PERSISTENCE}/knex-all-totals.repository.ts`;

  const fromBarrel = (names: string): string =>
    `import { ${names} } from '@/contexts/billing/infrastructure/persistence/knex-all-totals.repository';`;

  const reexport = (names: string): string =>
    `export { ${names} } from '@/contexts/billing/infrastructure/persistence/knex-invoice-totals.repository';\n`;

  it('reports the second store of a file whose first one the list imports under the name a barrel gives it', () => {
    const findings = reported({
      [TOTALS]: `${store('KnexInvoiceTotals')}\n${store('KnexLaterTotals')}`,
      [barrel]: reexport('KnexInvoiceTotals as Totals'),
      [LIST]: list({ imports: fromBarrel('Totals'), entries: "  ['billing', Totals]," }),
    });

    expect(findings.map(({ message }) => message.split(' ')[0])).toEqual(['KnexLaterTotals']);
  });

  it('reports a store a barrel re-exports beside the one the list imports through it, as a declarations barrel does', () => {
    const late = `${PERSISTENCE}/knex-late-totals.repository.ts`;

    const findings = reported({
      [TOTALS]: store('KnexInvoiceTotals'),
      [late]: store('KnexLateTotals'),
      [barrel]: `export * from '@/contexts/billing/infrastructure/persistence/knex-invoice-totals.repository';\nexport * from '@/contexts/billing/infrastructure/persistence/knex-late-totals.repository';\n`,
      [LIST]: list({ imports: fromBarrel('KnexInvoiceTotals'), entries: "  ['billing', KnexInvoiceTotals]," }),
    });

    expect(findings.map(({ file }) => file)).toEqual([late]);
  });

  it('takes no comment between markers the template does not write, which init --force deletes with them', () => {
    const more =
      '// ddd-ts-kit:extra\n// billing: KnexInvoiceTotals, left out: rebuilt each night\n// /ddd-ts-kit:extra';

    const kept = '  // billing: KnexInvoiceTotals, left out: rebuilt each night';

    expect(reported({ [TOTALS]: store('KnexInvoiceTotals'), [LIST]: list({ more }) }).map(({ file }) => file)).toEqual([
      TOTALS,
    ]);

    expect(reported({ [TOTALS]: store('KnexInvoiceTotals'), [LIST]: list({ notListed: kept }) })).toEqual([]);
  });

  it('reports a store a barrel re-exports when the entry names another class, which that barrel declares', () => {
    const findings = reported({
      [TOTALS]: store('KnexInvoiceTotals'),
      [barrel]: `${reexport('KnexInvoiceTotals')}\nexport class NotAStore {}\n`,
      [LIST]: list({ imports: fromBarrel('NotAStore'), entries: "  ['billing', NotAStore]," }),
    });

    expect(findings.map(({ file }) => file)).toEqual([TOTALS]);
  });

  it('says of an entry through a barrel that renames the class that another context declares it', () => {
    const findings = reported({
      [TOTALS]: store('KnexInvoiceTotals'),
      [barrel]: reexport('KnexInvoiceTotals as Totals'),
      [LIST]: list({ imports: fromBarrel('Totals'), entries: "  ['catalog', Totals]," }),
    });

    expect(findings.map(({ file }) => file).sort()).toEqual([TOTALS, LIST].sort());

    expect(findings.find(({ file }) => file === LIST)?.message).toContain(
      'LISTED names KnexInvoiceTotals under catalog, and src/contexts/billing/infrastructure/persistence/knex-invoice-totals.repository.ts declares it in billing',
    );
  });

  it('says once, on the class written to build a store, to list it, when neither is listed', () => {
    const builder = `${PERSISTENCE}/listed-knex-invoice-totals.repository.ts`;

    const findings = reported({
      [TOTALS]: store('KnexInvoiceTotals', { parameters: 'context: KnexContext, readonly size: number' }),
      [builder]: store('ListedKnexInvoiceTotals', { base: 'KnexInvoiceTotals' }),
      [LIST]: list(),
    });

    expect(findings.map(({ file }) => file)).toEqual([builder]);
    expect(findings[0]?.fix).toContain("`['billing', ListedKnexInvoiceTotals],` to LISTED");
  });
});
