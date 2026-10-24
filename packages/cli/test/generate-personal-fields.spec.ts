import { describe, expect, it } from 'vitest';
import { checkJsonOf } from './check-support';
import { bin, findingsOf } from './e2e/run-in';
import { cli, exists, read } from './helpers';
import { billingWithPersonalInvoices } from './support/billing-with-personal-invoices';
import { expectOk } from './support/expect-ok';

const BILLING = 'src/contexts/billing';
const PERSISTENCE = `${BILLING}/infrastructure/persistence`;
const DECLARATION = `${PERSISTENCE}/invoice.personal-fields.ts`;
const PORT = `${BILLING}/application/ports/billing-personal-data-erasure.port.ts`;
const COPIES = 'src/platform/privacy/data-subject-copies.ts';
const PERSONAL = ['--personal', 'customer_email,customer_name'];

function adapterOf(root: string, prefix: string): string {
  return read(root, `${PERSISTENCE}/${prefix}-billing-personal-data-erasure.repository.ts`);
}

describe('generate repository --personal declares the personal columns of the table', () => {
  it('writes the declaration next to the mapper, the columns in the storage, and the erasure of the context: port, adapter, fake, spec, copies', () => {
    const root = billingWithPersonalInvoices(['--orm', 'knex']);
    const declaration = read(root, DECLARATION);

    expect(declaration).toContain("const TABLE = { schema: BILLING_SCHEMA, table: 'invoices' };");
    expect(declaration).toContain('const declaration: PersonalFieldsOptions<InvoiceRow> = {');
    expect(declaration).toContain('export const InvoicePersonalFields = personalFields(TABLE, declaration);');

    expect(declaration).toContain(
      "  subject: 'id',\n  fields: ['customer_email', 'customer_name'],\n  erasure: 'pseudonymise',\n};",
    );

    expect(read(root, `${PERSISTENCE}/invoice-row.schema.ts`)).toContain(
      '  readonly registered_at: Date;\n  readonly customer_email: string | null;\n  readonly customer_name: string | null;\n',
    );

    expect(read(root, `${PERSISTENCE}/create-billing-tables.schema.ts`)).toContain(
      "    table.text('customer_email');\n    table.text('customer_name');\n",
    );

    expect(read(root, PORT)).toContain(
      'export abstract class BillingPersonalDataErasure extends PersonalDataErasure {}',
    );

    const adapter = adapterOf(root, 'knex');

    expect(adapter).toContain('@Repository(BillingPersonalDataErasure)');

    expect(adapter).toContain(
      'export class KnexBillingPersonalDataErasure extends KnexPersonalDataErasure implements BillingPersonalDataErasure {',
    );

    expect(adapter).toContain("  constructor(database: KnexContext) {\n    super(database, {\n      name: 'billing',");

    expect(adapter).toContain(
      '        // ddd-ts-kit:personal-fields\n        InvoicePersonalFields,\n        // /ddd-ts-kit:personal-fields',
    );

    expect(adapter).not.toContain('tenant:');

    expect(read(root, `${BILLING}/test/fakes/billing-personal-data-erasure.fake.ts`)).toContain(
      'export class FakeBillingPersonalDataErasure implements BillingPersonalDataErasure {',
    );

    const spec = read(root, `${BILLING}/test/integration/billing-personal-data.spec.ts`);

    expect(spec).toContain('expect(await erasure.erase(ada)).toBe(1);');
    expect(spec).toContain('expect(await rowOf(ada)).toMatchObject(ERASED);');
    expect(spec).toContain("  customer_email: 'customer_email of ada',\n  customer_name: 'customer_name of ada',\n");

    const copies = read(root, COPIES);

    expect(copies).toContain(
      "import { BillingPersonalDataErasure } from '@/contexts/billing/application/ports/billing-personal-data-erasure.port';",
    );

    expect(copies).toContain('  // ddd-ts-kit:copies\n  BillingPersonalDataErasure,\n  // /ddd-ts-kit:copies');

    expect(checkJsonOf(cli(root, 'check', '--json')).violations).toEqual([]);
  });

  it('spells the declaration as the erasure of each ORM reads it: the SQL names on Knex and Prisma, the properties on Drizzle and TypeORM', () => {
    const drizzle = billingWithPersonalInvoices([]);
    const prisma = billingWithPersonalInvoices(['--orm', 'prisma']);
    const typeorm = billingWithPersonalInvoices(['--orm', 'typeorm']);

    expect(read(drizzle, DECLARATION)).toContain(
      'export const InvoicePersonalFields = personalFields(invoices, declaration);',
    );

    expect(read(drizzle, DECLARATION)).toContain("  fields: ['customerEmail', 'customerName'],");

    expect(read(drizzle, `${PERSISTENCE}/billing.schema.ts`)).toContain(
      "  customerEmail: text('customer_email'),\n  customerName: text('customer_name'),\n",
    );

    expect(adapterOf(drizzle, 'drizzle')).toContain('extends DrizzlePersonalDataErasure<PgQueryResultHKT>');
    expect(adapterOf(drizzle, 'drizzle')).toContain('constructor(database: Database) {');

    expect(read(prisma, DECLARATION)).toContain(
      "const TABLE: PrismaPersonalTable = { schema: 'billing', table: 'invoices' };",
    );

    expect(read(prisma, DECLARATION)).toContain("  fields: ['customer_email', 'customer_name'],");

    expect(read(prisma, 'prisma/schema.prisma')).toContain(
      '  customerEmail String? @map("customer_email")\n  customerName String? @map("customer_name")\n',
    );

    expect(adapterOf(prisma, 'prisma')).toContain('extends PrismaPersonalDataErasure<Prisma.TransactionClient>');

    expect(read(typeorm, DECLARATION)).toContain(
      'export const InvoicePersonalFields = personalFields(invoices, declaration);',
    );

    expect(read(typeorm, DECLARATION)).toContain("  fields: ['customerEmail', 'customerName'],");

    expect(read(typeorm, `${PERSISTENCE}/billing.schema.ts`)).toContain(
      "    customerEmail: { name: 'customer_email', type: 'text', nullable: true },",
    );

    expect(read(typeorm, `${PERSISTENCE}/invoice-row.schema.ts`)).toContain('  customerEmail: string | null;');

    // The header no longer fits the width: each heritage clause on its own line, as the formatter lays it out.
    expect(adapterOf(typeorm, 'type-orm')).toContain(
      'export class TypeOrmBillingPersonalDataErasure\n  extends TypeOrmPersonalDataErasure\n  implements BillingPersonalDataErasure\n{\n',
    );

    for (const root of [drizzle, prisma, typeorm]) {
      expect(checkJsonOf(cli(root, 'check', '--json')).violations).toEqual([]);
    }
  });
});

describe('the subject, the mode of erasure and a second table of the same context', () => {
  it('names the person by another column than the id, adds that column to the storage, and deletes the rows when asked', () => {
    const root = billingWithPersonalInvoices(
      ['--orm', 'knex'],
      [...PERSONAL, '--subject', 'customer_id', '--erasure', 'row'],
    );

    const declaration = read(root, DECLARATION);

    expect(declaration).toContain("  subject: 'customer_id',");
    expect(declaration).toContain("  erasure: 'row',");
    expect(read(root, `${PERSISTENCE}/create-billing-tables.schema.ts`)).toContain("    table.text('customer_id');");

    const spec = read(root, `${BILLING}/test/integration/billing-personal-data.spec.ts`);

    expect(spec).toContain("  customer_id: 'ada',\n  customer_email: 'customer_email of ada',");
    expect(spec).toContain("expect(await erasure.erase('ada')).toBe(1);");
    expect(spec).toContain('expect(await rowOf(ada)).toBeUndefined();');
    expect(spec).not.toContain('ERASED');
  });

  it('adds the declaration of a second table to the erasure the context already has, which stays one', () => {
    const root = billingWithPersonalInvoices(['--orm', 'knex']);

    expectOk(cli(root, 'generate', 'aggregate', 'billing', 'Customer'));

    const second = expectOk(
      cli(root, 'generate', 'repository', 'billing', 'Customer', '--personal', 'email', '--json'),
    );

    const adapter = adapterOf(root, 'knex');

    expect(exists(root, `${PERSISTENCE}/customer.personal-fields.ts`)).toBe(true);

    expect(adapter).toContain(
      "import { CustomerPersonalFields } from '@/contexts/billing/infrastructure/persistence/customer.personal-fields';",
    );

    expect(adapter).toContain(
      '        InvoicePersonalFields,\n        CustomerPersonalFields,\n        // /ddd-ts-kit:personal-fields',
    );

    expect(second.stdout).toContain('CustomerPersonalFields joined the declarations of KnexBillingPersonalDataErasure');
    expect(read(root, COPIES).match(/BillingPersonalDataErasure,/g)).toHaveLength(1);
  });

  it('confines the erasure to the tenant of the work where the tables hold tenant data, on every ORM', () => {
    const root = billingWithPersonalInvoices(['--orm', 'knex', '--tenancy', 'shared-table']);
    const typeorm = billingWithPersonalInvoices(['--orm', 'typeorm', '--tenancy', 'shared-table']);
    const adapter = adapterOf(root, 'knex');

    // The tenant-scoped entity declares the personal columns too.
    expect(read(typeorm, `${PERSISTENCE}/billing.schema.ts`)).toContain(
      "    customerEmail: { name: 'customer_email', type: 'text', nullable: true },\n",
    );

    expect(adapterOf(typeorm, 'type-orm')).toContain('      tenant: { scope },\n');

    expect(adapter).toContain('  constructor(database: KnexContext, scope: ExecutionScope) {');
    expect(adapter).toContain('      tenant: scope,\n');

    expect(read(root, `${BILLING}/test/integration/billing-personal-data.spec.ts`)).toContain(
      'erasure = new KnexBillingPersonalDataErasure(database.persistence.database, scope);',
    );
  });
});

describe('what --personal writes is laid out as the formatter of the project wants it', () => {
  it.each([
    ['knex, declared', ['--orm', 'knex']],
    ['knex, wired by hand', ['--orm', 'knex', '--di', 'manual', '--http', 'fastify']],
    [
      'knex, explicit, tenant data, the row deleted',
      ['--orm', 'knex', '--style', 'explicit', '--tenancy', 'shared-table'],
    ],
    ['drizzle, another subject than the id', []],
    ['prisma', ['--orm', 'prisma']],
    ['typeorm', ['--orm', 'typeorm']],
  ] as const)('%s', (label, flags) => {
    const personal = label.includes('subject') ? [...PERSONAL, '--subject', 'customer_id'] : PERSONAL;

    const root = billingWithPersonalInvoices(
      flags,
      label.includes('deleted') ? [...personal, '--erasure', 'row'] : personal,
    );

    expect(findingsOf(root, { command: bin('biome'), args: ['format', '--max-diagnostics=50', '.'] })).toBe('');
  });
});
