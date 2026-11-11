import { describe, expect, it } from 'vitest';
import { checkJsonOf } from './check-support';
import { cli, exists, read } from './helpers';
import { report } from './reports';
import { expectOk } from './support/expect-ok';
import { billingProject, CONTRACT, PERSISTENCE, withInvoiceSummaries } from './support/read-model-project';

const SCHEMA = `${PERSISTENCE}/billing.schema.ts`;
const KNEX_TABLES = `${PERSISTENCE}/create-billing-tables.schema.ts`;
const PRISMA_MODELS = 'prisma/schema/billing.prisma';
const PLATFORM_SCHEMA = 'src/platform/database/schema.ts';

/** The aggregate Invoice of billing and its repository, generated after the read model. */
function addInvoiceRepository(root: string): void {
  expectOk(cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--term', 'Invoice=A request for payment'));
  expectOk(cli(root, 'generate', 'repository', 'billing', 'Invoice'));
}

describe('generate read-model, the table on Drizzle', () => {
  const root = billingProject();

  withInvoiceSummaries(root);

  it('declares the columns of the fields, each accepting null, with the check that keeps live rows whole', () => {
    const schema = read(root, SCHEMA);

    expect(schema).toContain("import { contextSchema, readModelColumns } from '@ddd-ts-kit/drizzle/postgres';");

    expect(schema).toContain(
      "import { check, text, numeric, timestamp, doublePrecision, boolean } from 'drizzle-orm/pg-core';",
    );

    expect(schema).toContain("import { sql } from 'drizzle-orm';");

    expect(schema).toContain(
      [
        'export const invoiceSummaries = billingSchema.table(',
        "  'invoice_summaries',",
        '  {',
        "    id: text('id').primaryKey(),",
        "    customerId: text('customer_id'),",
        "    total: numeric('total'),",
        "    issuedAt: timestamp('issued_at', { withTimezone: true, mode: 'date' }),",
        "    paidAt: timestamp('paid_at', { withTimezone: true, mode: 'date' }),",
        "    lines: doublePrecision('lines'),",
        "    paid: boolean('paid'),",
        '    ...readModelColumns(),',
        '  },',
        '  (table) => [',
        '    check(',
        "      'invoice_summaries_live_rows_whole',",
        '      sql`${table.deleted} or (${table.customerId} is not null and ${table.total} is not null and ${table.issuedAt} is not null and ${table.lines} is not null and ${table.paid} is not null)`,',
        '    ),',
        '  ],',
        ');',
      ].join('\n'),
    );

    expect(read(root, PLATFORM_SCHEMA)).toContain(
      "export * from '@/contexts/billing/infrastructure/persistence/billing.schema';",
    );
  });

  it('maps each field of the row to its column in the store adapter', () => {
    const adapter = read(root, `${PERSISTENCE}/drizzle-invoice-summaries.repository.ts`);

    expect(adapter).toContain('  constructor(database: Database) {\n    super(database, {');
    expect(adapter).toContain('      table: invoiceSummaries,\n      key: invoiceSummaries.id,\n      columns: {');
    expect(adapter).toContain('        paidAt: invoiceSummaries.paidAt,\n        lines: invoiceSummaries.lines,');
  });

  it('lets the repository of an aggregate join the schema it started, with the columns it imports', () => {
    addInvoiceRepository(root);

    expect(read(root, SCHEMA)).toContain(
      "import { check, text, numeric, timestamp, doublePrecision, boolean, integer } from 'drizzle-orm/pg-core';",
    );

    expect(read(root, SCHEMA)).toContain("export const invoices = billingSchema.table('invoices', {");
    expect(checkJsonOf(cli(root, 'check', '--json')).violations).toEqual([]);
  });
});

describe('generate read-model, the table on Knex', () => {
  const root = billingProject('--orm', 'knex');

  withInvoiceSummaries(root);

  it('creates the table with its columns and those of the store, in the schema of the context', () => {
    const tables = read(root, KNEX_TABLES);

    expect(tables).toContain("import { readModelColumns } from '@ddd-ts-kit/knex';");
    expect(tables).toContain('  await createInvoiceSummariesTable(knex);');

    expect(tables).toContain(
      [
        'function createInvoiceSummariesTable(knex: Knex): Promise<void> {',
        "  return knex.schema.withSchema(BILLING_SCHEMA).createTable('invoice_summaries', (table) => {",
        "    table.text('id').primary();",
        "    table.text('customer_id');",
        "    table.specificType('total', 'numeric');",
        "    table.datetime('issued_at', { useTz: true, precision: 3 });",
        "    table.datetime('paid_at', { useTz: true, precision: 3 });",
        "    table.double('lines');",
        "    table.boolean('paid');",
        '    readModelColumns(table);',
        '',
        '    table.check(',
        "      'deleted or (customer_id is not null and total is not null and issued_at is not null and lines is not null and paid is not null)',",
        '      {},',
        "      'invoice_summaries_live_rows_whole',",
        '    );',
        '  });',
        '}',
      ].join('\n'),
    );

    expect(exists(root, SCHEMA)).toBe(true);
    expect(read(root, PLATFORM_SCHEMA)).toContain('await createBillingTables(knex);');
  });

  it('names the schema, the table and the column of each field in the store adapter', () => {
    const adapter = read(root, `${PERSISTENCE}/knex-invoice-summaries.repository.ts`);

    expect(adapter).toContain("      schema: BILLING_SCHEMA,\n      table: 'invoice_summaries',\n      columns: {");
    expect(adapter).toContain("        id: 'id',\n        customerId: 'customer_id',\n        total: 'total',");
    expect(adapter).toContain('  constructor(database: KnexContext) {');
  });
});

describe('generate read-model, the model on Prisma', () => {
  const root = billingProject('--orm', 'prisma');
  const generated = report(withInvoiceSummaries(root));

  it('writes the model in the file of the context, with the fields of the store, and its schema in the datasource', () => {
    expect(read(root, PRISMA_MODELS)).toContain(
      [
        'model BillingInvoiceSummaries {',
        '  id String @id',
        '  customerId String? @map("customer_id")',
        '  total Decimal?',
        '  issuedAt DateTime? @map("issued_at") @db.Timestamptz(3)',
        '  paidAt DateTime? @map("paid_at") @db.Timestamptz(3)',
        '  lines Float?',
        '  paid Boolean?',
        '  // TODO(domain): the schema language has no check constraint. Add to the migration that creates this table, after its CREATE TABLE, what keeps the rows that are not removed whole: ALTER TABLE "billing"."invoice_summaries" ADD CONSTRAINT "invoice_summaries_live_rows_whole" CHECK ("deleted" OR ("customer_id" IS NOT NULL AND "total" IS NOT NULL AND "issued_at" IS NOT NULL AND "lines" IS NOT NULL AND "paid" IS NOT NULL));',
        '  /// The event that last changed the row: an older one changes nothing.',
        '  lastEventId String @map("last_event_id")',
        '  lastEventAt DateTime @map("last_event_at") @db.Timestamptz(3)',
        '  lastEventVersion BigInt? @map("last_event_version")',
        '  /// The trace of a removed row, so that a late event does not bring it back.',
        '  deleted Boolean @default(false)',
        '',
        '  @@map("invoice_summaries")',
        '  @@schema("billing")',
        '}',
      ].join('\n'),
    );

    expect(read(root, 'prisma/schema/schema.prisma')).toContain('"billing"]');
    expect(generated.notes.join('\n')).toContain('db:client');
  });

  it('reaches the model through its delegate in the store adapter', () => {
    const adapter = read(root, `${PERSISTENCE}/prisma-invoice-summaries.repository.ts`);

    expect(adapter).toContain('PrismaReadModelStore<InvoiceSummariesRow, Prisma.TransactionClient>');
    expect(adapter).toContain('      delegate: (client) => client.billingInvoiceSummaries,');
    expect(adapter).toContain("      schema: 'billing',\n      table: 'invoice_summaries',");
  });
});

describe('generate read-model, the entity on TypeORM', () => {
  const root = billingProject('--orm', 'typeorm');

  withInvoiceSummaries(root);

  it('declares the entity over the row and the stamps of the store, and lists it among the entities', () => {
    const schema = read(root, SCHEMA);

    expect(schema).toContain(
      "import { schemaNameOf, readModelColumns, type ReadModelStamps } from '@ddd-ts-kit/typeorm';",
    );

    expect(schema).toContain(
      [
        'export const invoiceSummaries = new EntitySchema<InvoiceSummariesRow & ReadModelStamps>({',
        "  name: 'BillingInvoiceSummaries',",
        "  tableName: 'invoice_summaries',",
        '  schema: BILLING_SCHEMA,',
        '  columns: {',
        "    id: { type: 'text', primary: true },",
        "    customerId: { name: 'customer_id', type: 'text', nullable: true },",
        "    total: { type: 'numeric', nullable: true },",
        "    issuedAt: { name: 'issued_at', type: 'timestamp with time zone', precision: 3, nullable: true },",
        "    paidAt: { name: 'paid_at', type: 'timestamp with time zone', precision: 3, nullable: true },",
        "    lines: { type: 'double precision', nullable: true },",
        "    paid: { type: 'boolean', nullable: true },",
        '    ...readModelColumns(),',
        '  },',
        '  checks: [',
        '    {',
        "      name: 'invoice_summaries_live_rows_whole',",
        '      expression:',
        `        '"deleted" or ("customer_id" is not null and "total" is not null and "issued_at" is not null and "lines" is not null and "paid" is not null)',`,
        '    },',
        '  ],',
        '});',
      ].join('\n'),
    );

    expect(read(root, PLATFORM_SCHEMA)).toContain('  invoiceSummaries,\n');
  });

  it('hands the entity to the store, and lets the repository of an aggregate join the schema it started', () => {
    expect(read(root, `${PERSISTENCE}/type-orm-invoice-summaries.repository.ts`)).toContain(
      '    super(database, { entity: invoiceSummaries, definition: invoiceSummariesCriteria });',
    );

    addInvoiceRepository(root);

    expect(read(root, SCHEMA)).toContain(
      "import { schemaNameOf, readModelColumns, type ReadModelStamps, auditColumns } from '@ddd-ts-kit/typeorm';",
    );

    expect(checkJsonOf(cli(root, 'check', '--json')).violations).toEqual([]);
  });
});

describe('generate read-model, without an ORM', () => {
  it('keeps the read model in memory: no table, and a contract that needs no database', () => {
    const root = billingProject('--orm', 'none');
    const generated = report(withInvoiceSummaries(root, '--tenant-scoped'));

    expect(exists(root, SCHEMA)).toBe(false);
    expect(read(root, CONTRACT)).not.toContain('openTestDatabase');
    expect(read(root, CONTRACT)).toContain('  createStore: () => new InMemoryInvoiceSummaries(),');

    expect(read(root, `${PERSISTENCE}/in-memory-invoice-summaries.repository.ts`)).toContain(
      '  constructor() {\n    super(invoiceSummariesCriteria);\n  }',
    );

    expect(generated.notes.join('\n')).toContain(
      '--tenant-scoped is written for drizzle, knex, prisma and typeorm: InMemoryInvoiceSummaries keeps one read model in memory for every tenant.',
    );

    expect(generated.notes.join('\n')).not.toContain('db:generate');
  });
});
