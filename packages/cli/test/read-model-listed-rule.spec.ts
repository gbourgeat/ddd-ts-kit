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
