import { CONFIG_FILE } from '../../config';
import { config } from './config';
import type { Fixture } from './fixture';
import type { FixtureFiles } from './fixture-files';
import { PATHS } from './paths';
import { project } from './project';
import { source } from './source';

const RULE = 'persistence/read-model-listed';
const LIST = 'src/platform/database/read-model-tables.ts';
const PERSISTENCE = `${PATHS.BILLING}/infrastructure/persistence`;
const TOTALS = `${PERSISTENCE}/knex-invoice-totals.repository.ts`;
const TOTALS_ALIAS = '@/contexts/billing/infrastructure/persistence/knex-invoice-totals.repository';
const CATALOG_TOTALS = `${PATHS.CATALOG}/infrastructure/persistence/knex-invoice-totals.repository.ts`;
const CATALOG_ALIAS = '@/contexts/catalog/infrastructure/persistence/knex-invoice-totals.repository';
const ANY_TOTALS = `${PERSISTENCE}/knex-any-totals.repository.ts`;
const ANY_ALIAS = '@/contexts/billing/infrastructure/persistence/knex-any-totals.repository';
const ENTRY = "  ['billing', KnexInvoiceTotals],";

/** A store as `generate read-model` writes it: over the store of the kit, built on the storage. */
const STORE = store('KnexInvoiceTotals', 'KnexReadModelStore<Total>');

const IMPORT = `import { KnexInvoiceTotals } from '${TOTALS_ALIAS}';`;

/** A store the list cannot build as it is: a generic class, whose constructor takes a size too. */
const GENERIC = source(
  'export class KnexAnyTotals<Row extends object> extends KnexReadModelStore<Row> {',
  '  constructor(context: KnexContext, readonly size: number) {',
  '    super(context, { table: TABLE });',
  '  }',
  '}',
);

export const READ_MODEL_LISTED_FIXTURES: readonly Fixture[] = [
  {
    ruleId: RULE,
    name: 'a read model store the list holds under its context',
    expect: 'pass',
    files: onKnex({ [TOTALS]: STORE, [LIST]: list({ imports: [IMPORT], entries: [ENTRY] }) }),
  },
  {
    ruleId: RULE,
    name: 'a read model store written by hand that the list does not hold',
    expect: { file: TOTALS },
    files: onKnex({ [TOTALS]: STORE, [LIST]: list({}) }),
  },
  {
    ruleId: RULE,
    name: 'a store over a base class of the project, declared in the shared kernel, that the list does not hold',
    expect: { file: TOTALS },
    files: onKnex({
      'src/shared-kernel/totals-store.ts': store('TotalsStore', 'KnexReadModelStore<Total>'),
      [TOTALS]: store('KnexInvoiceTotals', 'TotalsStore'),
      [LIST]: list({}),
    }),
  },
  {
    ruleId: RULE,
    name: 'a generic store the list neither builds through a class of its own nor names',
    expect: { file: ANY_TOTALS },
    files: onKnex({ [ANY_TOTALS]: GENERIC, [LIST]: list({}) }),
  },
  {
    ruleId: RULE,
    name: 'a generic store the list builds through a class it declares over it',
    expect: 'pass',
    files: onKnex({
      [ANY_TOTALS]: GENERIC,
      [LIST]: list({
        imports: [`import { KnexAnyTotals } from '${ANY_ALIAS}';`],
        entries: ["  ['billing', ListedKnexAnyTotals],"],
        more: 'class ListedKnexAnyTotals extends KnexAnyTotals<object> {}',
      }),
    }),
  },
  {
    ruleId: RULE,
    name: 'a store the list names in NOT_LISTED, which the start tells',
    expect: 'pass',
    files: onKnex({ [ANY_TOTALS]: GENERIC, [LIST]: list({ notListed: ["  'billing: KnexAnyTotals',"] }) }),
  },
  {
    ruleId: RULE,
    name: 'a store left out on purpose by a comment of the list that holds its context and its name',
    expect: 'pass',
    files: onKnex({
      [TOTALS]: STORE,
      [LIST]: list({ entries: ['  // billing: KnexInvoiceTotals, left out: rebuilt each night'] }),
    }),
  },
  {
    ruleId: RULE,
    name: 'a comment that leaves out a store of a longer name, which does not answer for this one',
    expect: { file: TOTALS },
    files: onKnex({
      [TOTALS]: STORE,
      [LIST]: list({ entries: ['  // billing: KnexInvoiceTotalsArchive, left out: rebuilt each night'] }),
    }),
  },
  {
    ruleId: RULE,
    name: 'stores of the same name in two contexts, the second imported under an alias',
    expect: 'pass',
    files: onKnex({
      [TOTALS]: STORE,
      [CATALOG_TOTALS]: STORE,
      [LIST]: list({
        imports: [IMPORT, `import { KnexInvoiceTotals as CatalogKnexInvoiceTotals } from '${CATALOG_ALIAS}';`],
        entries: [ENTRY, "  ['catalog', CatalogKnexInvoiceTotals],"],
      }),
    }),
  },
  {
    ruleId: RULE,
    name: 'an abstract base, a store in memory, a store in a search engine, a store of a test and a class over the kernel table store, none listed',
    expect: 'pass',
    files: onKnex({
      [TOTALS]: [
        store('KnexInvoiceTotals', 'KnexReadModelStore<Total>').replace('export class', 'export abstract class'),
        ...[
          store('InMemoryInvoiceTotals', 'InMemoryReadModelStore<Total>'),
          store('SearchInvoiceTotals', 'OpenSearchReadModelStore<Total>'),
          store('OwnTableInvoiceTotals', 'TableReadModelStore<Total>'),
          store('LoopA', 'LoopB'),
          store('LoopB', 'LoopA'),
        ].map((unexported) => unexported.replace('export class', 'class')),
      ].join('\n'),
      [`${PATHS.BILLING}/test/fakes/invoice-totals.fake.ts`]: store('InvoiceTotalsFake', 'KnexReadModelStore<Total>'),
      [LIST]: list({}),
    }),
  },
  {
    ruleId: RULE,
    name: 'a project on an ORM of the kit that holds stores and no list',
    expect: { file: LIST },
    files: onKnex({ [TOTALS]: STORE, [CATALOG_TOTALS]: STORE }),
  },
  {
    ruleId: RULE,
    name: 'a project on an ORM of the kit that holds one store and no list',
    expect: { file: LIST },
    files: onKnex({ [TOTALS]: STORE }),
  },
  {
    ruleId: RULE,
    name: 'a project without an ORM of the kit, for which init writes no list',
    expect: 'pass',
    files: project(
      { [TOTALS]: STORE },
      { [CONFIG_FILE]: config({ importExtension: 'none', stack: { orm: 'custom' } }) },
    ),
  },
  {
    ruleId: RULE,
    name: 'an entry that names a store under a context that is not its own',
    expect: { file: LIST },
    files: onKnex({
      [TOTALS]: STORE,
      [LIST]: list({
        imports: [IMPORT],
        entries: ["  ['catalog', KnexInvoiceTotals],", '  // billing: KnexInvoiceTotals, checked elsewhere'],
      }),
    }),
  },
  {
    ruleId: RULE,
    name: 'an entry whose class is imported from a file that does not exist',
    expect: { file: LIST },
    files: onKnex({ [LIST]: list({ imports: [IMPORT], entries: [ENTRY] }) }),
  },
  {
    ruleId: RULE,
    name: 'an entry whose class is imported from a file that names no such class',
    expect: { file: LIST },
    files: onKnex({
      [TOTALS]: 'export const TABLE = "totals";\n',
      [LIST]: list({ imports: [IMPORT], entries: [ENTRY] }),
    }),
  },
  {
    ruleId: RULE,
    name: 'an entry whose class the list neither imports nor declares',
    expect: { file: LIST },
    files: onKnex({ [LIST]: list({ entries: [ENTRY] }) }),
  },
  {
    ruleId: RULE,
    name: 'entries whose class comes from a barrel, a folder, a package, a class the list declares alone or an expression',
    expect: 'pass',
    files: onKnex({
      [`${PERSISTENCE}/knex-all-totals.repository.ts`]: `export * from '${TOTALS_ALIAS}';\n`,
      ['src/platform/stores/index.ts']: `export * from '${TOTALS_ALIAS}';\n`,
      [TOTALS]: `${STORE}\nexport const KnexLateTotals = class extends KnexInvoiceTotals {};\n`,
      [LIST]: list({
        imports: [
          "import { KnexInvoiceTotals } from '@/contexts/billing/infrastructure/persistence/knex-all-totals.repository';",
          "import { KnexInvoiceTotals as FromFolder } from '@/platform/stores';",
          `import { KnexLateTotals } from '${TOTALS_ALIAS}';`,
          "import { PackagedTotals, type Unused } from '@acme/read-models';",
        ],
        entries: [
          "  ['billing', Looping],",
          ENTRY,
          "  ['billing', FromFolder],",
          "  ['billing', KnexLateTotals],",
          "  ['billing', PackagedTotals],",
          "  ['billing', OwnTotals],",
        ],
        more: 'class OwnTotals {}\n\nclass Looping extends Looping {}',
      }),
    }),
  },
  {
    ruleId: RULE,
    name: 'a line of NOT_LISTED that names a store its context no longer holds',
    expect: { file: LIST },
    files: onKnex({ [LIST]: list({ notListed: ["  'billing: KnexInvoiceTotals',", "  'a note of the team',"] }) }),
  },
  {
    ruleId: RULE,
    name: 'a list whose entries are spread from elsewhere, which cannot be read',
    expect: { file: LIST },
    files: onKnex({ [TOTALS]: STORE, [LIST]: list({ entries: ['  ...MORE,'] }) }),
  },
  {
    ruleId: RULE,
    name: 'a list file that declares no LISTED array',
    expect: { file: LIST },
    files: onKnex({ [TOTALS]: STORE, [LIST]: 'export const tables = [];\n' }),
  },
];

function onKnex(files: FixtureFiles): FixtureFiles {
  return project(files, { [CONFIG_FILE]: config({ importExtension: 'none', stack: { orm: 'knex' } }) });
}

function store(name: string, base: string): string {
  return source(
    `export class ${name} extends ${base} {`,
    '  constructor(context: KnexContext) {',
    '    super(context, { table: TABLE });',
    '  }',
    '}',
  );
}

/** The list as `init` writes it, with what a fixture puts between its markers and after them. */
function list(held: {
  readonly imports?: readonly string[];
  readonly entries?: readonly string[];
  readonly notListed?: readonly string[];
  readonly more?: string;
}): string {
  return source(
    "import type { Persistence } from '@/platform/database/persistence';",
    '// ddd-ts-kit:imports',
    ...(held.imports ?? []),
    '// /ddd-ts-kit:imports',
    '',
    'type Store = new (database: Persistence) => object;',
    '',
    "const LISTED: readonly (readonly [context: 'billing' | 'catalog', store: Store])[] = [",
    '  // ddd-ts-kit:read-model-tables',
    ...(held.entries ?? []),
    '  // /ddd-ts-kit:read-model-tables',
    '];',
    '',
    'const NOT_LISTED: readonly string[] = [',
    '  // ddd-ts-kit:read-models-not-listed',
    ...(held.notListed ?? []),
    '  // /ddd-ts-kit:read-models-not-listed',
    '];',
    '',
    'export const readModelTables = { LISTED, NOT_LISTED };',
    ...(held.more === undefined ? [] : ['', held.more]),
  );
}
