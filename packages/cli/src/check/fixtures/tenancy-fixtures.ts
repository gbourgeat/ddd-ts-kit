import { CONFIG_FILE } from '../../config/index.js';
import { config } from './config.js';
import type { Fixture } from './fixture.js';
import { PATHS } from './paths.js';
import { project } from './project.js';

const RULE = 'tenancy/scoped-statement';
const KNEX_ADAPTER = `${PATHS.BILLING}/infrastructure/persistence/knex-invoice.repository.ts`;
const DRIZZLE_ADAPTER = `${PATHS.BILLING}/infrastructure/persistence/drizzle-invoice.repository.ts`;

const KNEX_SCOPED = `import { ownTenantTable, tenantTable } from '@ddd-ts-kit/knex';

export class KnexInvoiceRepository {
  findById(id: string) {
    return tenantTable(this.database, this.scope, INVOICES).where({ id }).first();
  }

  remove(id: string) {
    return ownTenantTable(this.database, this.scope, INVOICES).where({ id }).delete();
  }
}
`;

const KNEX_UNSCOPED = `export class KnexInvoiceRepository {
  findById(id: string) {
    return this.database.executor()<InvoiceRow, InvoiceRow[]>('invoices').where({ id }).first();
  }
}
`;

const DRIZZLE_SCOPED = `import { ownTenantCondition, tenantCondition } from '@ddd-ts-kit/drizzle/postgres';
import { tenantScopeOf } from '@ddd-ts-kit/kernel';

export class DrizzleInvoiceRepository {
  findById(id: string) {
    const mine = and(eq(invoices.id, id), tenantCondition(invoices.tenantId, this.scope));

    return this.database.executor().select().from(invoices).where(mine);
  }

  insert(state: InvoiceRow) {
    const row = { ...state, ...tenantScopeOf(this.scope) };

    return this.database.executor().insert(invoices).values(row);
  }

  remove(id: string) {
    return this.database
      .executor()
      .delete(invoices)
      .where(and(eq(invoices.id, id), ownTenantCondition(invoices.tenantId, this.scope)));
  }
}
`;

const DRIZZLE_UNSCOPED = `export class DrizzleInvoiceRepository {
  findById(id: string) {
    return this.database.executor().select().from(invoices).where(eq(invoices.id, id));
  }
}
`;

/** Aggregates over the rows `tenantTable` confines: raw expressions that reach no table themselves. */
const RAW_EXPRESSIONS = `export class KnexInvoiceRepository {
  totals() {
    return tenantTable(this.database, this.scope, INVOICES).select(
      this.database.executor().raw('(count(*) filter (where paid))::integer as paid'),
      this.database.executor().raw('coalesce(sum(round(amount)) filter (where state = any(?)), 0)::numeric(12, 2) as due', [states]),
      this.database.executor().raw("customer_id || ' from ' || day as label"),
    );
  }
}
`;

const tenancy = (orm: string, value = 'shared-table') => ({
  [CONFIG_FILE]: config({ stack: { orm, tenancy: value } }),
});

/** A repository of a shared-table project whose one method goes around the helpers. */
const bypass = (orm: 'knex' | 'drizzle', name: string, body: string): Fixture => {
  const adapter = orm === 'knex' ? KNEX_ADAPTER : DRIZZLE_ADAPTER;
  const owner = orm === 'knex' ? 'KnexInvoiceRepository' : 'DrizzleInvoiceRepository';

  return {
    ruleId: RULE,
    name: `${orm}: ${name}`,
    expect: { file: adapter },
    files: project({ [adapter]: `export class ${owner} {\n  find() {\n    ${body}\n  }\n}\n` }, tenancy(orm)),
  };
};

const READ_MODEL = `${PATHS.BILLING}/infrastructure/persistence/knex-invoice-totals.repository.ts`;

const readModel = (name: string, source: string, expected: Fixture['expect']): Fixture => ({
  ruleId: RULE,
  name: `read model store ${name}`,
  expect: expected,
  files: project({ [READ_MODEL]: source }, tenancy('knex')),
});

export const TENANCY_FIXTURES: readonly Fixture[] = [
  {
    ruleId: RULE,
    name: 'a knex adapter reaching tenant data through the helpers',
    expect: 'pass',
    files: project({ [KNEX_ADAPTER]: KNEX_SCOPED }, tenancy('knex')),
  },
  {
    ruleId: RULE,
    name: 'a knex table reached straight from the executor on shared tables',
    expect: { file: KNEX_ADAPTER },
    files: project({ [KNEX_ADAPTER]: KNEX_UNSCOPED }, tenancy('knex')),
  },
  {
    ruleId: RULE,
    name: 'a knex executor handed to a helper, which confines it',
    expect: 'pass',
    files: project(
      {
        [KNEX_ADAPTER]:
          'export class KnexInvoiceRepository {\n  insert(row: Row) {\n    return insertIgnoringConflict(this.database.executor(), ownTenantTable(this.database, this.scope, T), { row });\n  }\n}\n',
      },
      tenancy('knex'),
    ),
  },
  bypass('knex', 'a table reached by from()', "return this.database.executor().from('invoices');"),
  bypass('knex', 'a select chained on the executor', "return this.database.executor().select('id').from('invoices');"),
  bypass('knex', 'a table reached by table()', "return this.database.executor().table('invoices');"),
  bypass('knex', 'raw SQL', "return this.database.executor().raw('select * from invoices');"),
  bypass('knex', 'raw SQL in a template', 'return this.database.executor().raw(`select * from ${INVOICES}`);'),
  bypass('knex', 'raw SQL whose text is not a literal', 'return this.database.executor().raw(statement);'),
  bypass(
    'knex',
    'raw SQL completed by an interpolation',
    'return this.database.executor().raw(`${statement} where id = ?`, [id]);',
  ),
  bypass('knex', 'raw SQL that names a table alone', "return this.database.executor().raw('table invoices');"),
  bypass(
    'knex',
    'raw SQL that starts with a common table',
    "return this.database.executor().raw('with due as (table invoices) table due');",
  ),
  bypass('knex', 'raw SQL of values', "return this.database.executor().raw('values (1), (2)');"),
  bypass('knex', 'raw SQL that calls a procedure', "return this.database.executor().raw('call purge_invoices()');"),
  bypass('knex', 'raw SQL that calls a function', "return this.database.executor().raw('purge_all()');"),
  {
    ruleId: RULE,
    name: 'knex: a raw expression in the select of a confined statement, and a constraint of the schema',
    expect: 'pass',
    files: project(
      {
        [KNEX_ADAPTER]: RAW_EXPRESSIONS,
        [`${PATHS.BILLING}/infrastructure/persistence/create-billing-tables.schema.ts`]:
          "export const holdOnce = (knex: Knex) => knex.raw('alter table ??.?? add constraint held_once exclude using gist (desk with =)', [S, T]);\n",
      },
      tenancy('knex'),
    ),
  },
  bypass(
    'knex',
    'the executor held in a variable',
    "const db = this.database.executor();\n\n    return db('invoices');",
  ),
  {
    ruleId: RULE,
    name: 'a drizzle adapter that writes no tenant condition',
    expect: { file: DRIZZLE_ADAPTER },
    files: project({ [DRIZZLE_ADAPTER]: DRIZZLE_UNSCOPED }, tenancy('drizzle')),
  },
  {
    ruleId: RULE,
    name: 'a drizzle adapter with its tenant condition in every statement',
    expect: 'pass',
    files: project({ [DRIZZLE_ADAPTER]: DRIZZLE_SCOPED }, tenancy('drizzle')),
  },
  {
    ruleId: RULE,
    name: 'drizzle: one statement without a condition, in an adapter that writes one elsewhere',
    expect: { file: DRIZZLE_ADAPTER },
    files: project(
      {
        [DRIZZLE_ADAPTER]: DRIZZLE_SCOPED.replace(
          '  remove(id: string) {',
          '  all() {\n    return this.database.executor().select().from(invoices);\n  }\n\n  remove(id: string) {',
        ),
      },
      tenancy('drizzle'),
    ),
  },
  bypass(
    'drizzle',
    'an insert that names no tenant',
    'return this.database.executor().insert(invoices).values(state);',
  ),
  bypass('drizzle', 'a relational query', 'return this.database.executor().query.invoices.findMany();'),
  bypass('drizzle', 'raw SQL', 'return this.database.executor().execute(sql`select * from invoices`);'),
  readModel(
    'built without its tenant',
    'export class KnexInvoiceTotals extends KnexReadModelStore<Total> {\n  constructor(context: KnexContext) {\n    super(context, { table: TABLE });\n  }\n}\n',
    { file: READ_MODEL },
  ),
  readModel(
    'built with new and without its tenant',
    'export class KnexInvoiceTotals {\n  private readonly rows = new KnexReadModelTable<Total>(this.context, { table: TABLE });\n\n  constructor(private readonly context: KnexContext) {}\n}\n',
    { file: READ_MODEL },
  ),
  readModel(
    'built with its tenant',
    'export class KnexInvoiceTotals extends KnexReadModelStore<Total> {\n  constructor(context: KnexContext, scope: ExecutionScope) {\n    super(context, { table: TABLE, tenant: scope });\n  }\n}\n',
    'pass',
  ),
  {
    ruleId: RULE,
    name: 'a project of one customer, which says nothing of tenancy',
    expect: 'pass',
    files: project({ [KNEX_ADAPTER]: KNEX_UNSCOPED }, { [CONFIG_FILE]: config({ stack: { orm: 'knex' } }) }),
  },
];
