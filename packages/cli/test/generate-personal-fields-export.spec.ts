import { describe, expect, it } from 'vitest';
import { checkJsonOf } from './check-support';
import { cli, read } from './helpers';
import { billingWithPersonalInvoices } from './support/billing-with-personal-invoices';
import { expectOk } from './support/expect-ok';

const BILLING = 'src/contexts/billing';
const PERSISTENCE = `${BILLING}/infrastructure/persistence`;
const EXPORT_PORT = `${BILLING}/application/ports/billing-personal-data-export.port.ts`;
const SPEC = `${BILLING}/test/integration/billing-personal-data.spec.ts`;
const EXPORTS = 'src/platform/privacy/data-subject-exports.ts';
const PERSONAL = ['--personal', 'customer_email,customer_name'];

function exportAdapterOf(root: string, prefix: string): string {
  return read(root, `${PERSISTENCE}/${prefix}-billing-personal-data-export.repository.ts`);
}

describe('generate repository --personal writes the export of the context beside its erasure', () => {
  it('writes the port, the adapter over the export of the ORM package, the fake, the spec and the line in the exports of the platform', () => {
    const root = billingWithPersonalInvoices(['--orm', 'knex']);

    expect(read(root, EXPORT_PORT)).toContain(
      'export abstract class BillingPersonalDataExport extends PersonalDataExport {}',
    );

    const adapter = exportAdapterOf(root, 'knex');

    expect(adapter).toContain('@Repository(BillingPersonalDataExport)');

    expect(adapter).toContain(
      'export class KnexBillingPersonalDataExport extends KnexPersonalDataExport implements BillingPersonalDataExport {',
    );

    expect(adapter).toContain("  constructor(database: KnexContext) {\n    super(database, {\n      name: 'billing',");

    expect(adapter).toContain(
      '        // ddd-ts-kit:personal-fields\n        InvoicePersonalFields,\n        // /ddd-ts-kit:personal-fields',
    );

    expect(read(root, `${BILLING}/test/fakes/billing-personal-data-export.fake.ts`)).toContain(
      'export class FakeBillingPersonalDataExport implements BillingPersonalDataExport {',
    );

    const spec = read(root, SPEC);

    expect(spec).toContain("const SOURCE = 'billing.invoices';");
    expect(spec).toContain("  customer_email: 'customer_email of ada',\n  customer_name: 'customer_name of ada',\n};");

    expect(spec).toContain(
      'expect(await exported.exportOf(ada)).toEqual([{ source: SOURCE, values: EXPORTED_OF_ADA }]);',
    );

    expect(spec).toContain(
      'expect(await exported.exportOf(ada)).toEqual([{ source: SOURCE, values: EXPORTED_ERASED }]);',
    );

    expect(spec).toContain('exported = new KnexBillingPersonalDataExport(database.persistence.database);');

    const exports = read(root, EXPORTS);

    expect(exports).toContain(
      "import { BillingPersonalDataExport } from '@/contexts/billing/application/ports/billing-personal-data-export.port';",
    );

    expect(exports).toContain('  // ddd-ts-kit:exports\n  BillingPersonalDataExport,\n  // /ddd-ts-kit:exports');
    expect(checkJsonOf(cli(root, 'check', '--json')).violations).toEqual([]);
  });

  it('extends the export of each ORM package with the same type argument as the erasure, and keys the records as the declaration', () => {
    const drizzle = billingWithPersonalInvoices([]);
    const prisma = billingWithPersonalInvoices(['--orm', 'prisma']);
    const typeorm = billingWithPersonalInvoices(['--orm', 'typeorm']);

    expect(exportAdapterOf(drizzle, 'drizzle')).toContain(
      'export class DrizzleBillingPersonalDataExport\n  extends DrizzlePersonalDataExport<PgQueryResultHKT>\n  implements BillingPersonalDataExport\n{',
    );

    expect(exportAdapterOf(prisma, 'prisma')).toContain(
      'export class PrismaBillingPersonalDataExport\n  extends PrismaPersonalDataExport<Prisma.TransactionClient>\n  implements BillingPersonalDataExport\n{',
    );

    expect(exportAdapterOf(typeorm, 'type-orm')).toContain(
      'export class TypeOrmBillingPersonalDataExport extends TypeOrmPersonalDataExport implements BillingPersonalDataExport {',
    );

    // Prisma writes its rows by property and declares its columns by SQL name: the export answers the SQL names.
    const spec = read(prisma, SPEC);

    expect(spec).toContain("const OF_ADA: Personal = {\n  customerEmail: 'customer_email of ada',");
    expect(spec).toContain("const EXPORTED_OF_ADA = {\n  customer_email: 'customer_email of ada',");
    expect(read(typeorm, SPEC)).toContain("const EXPORTED_OF_ADA = {\n  customerEmail: 'customer_email of ada',");
  });

  it('joins a second table to the export too, names the person by another column, and reads nothing once a row is deleted', () => {
    const root = billingWithPersonalInvoices(['--orm', 'knex']);

    const deleted = billingWithPersonalInvoices(
      ['--orm', 'knex'],
      [...PERSONAL, '--subject', 'customer_id', '--erasure', 'row'],
    );

    expectOk(cli(root, 'generate', 'aggregate', 'billing', 'Customer'));

    const second = expectOk(
      cli(root, 'generate', 'repository', 'billing', 'Customer', '--personal', 'email', '--json'),
    );

    expect(exportAdapterOf(root, 'knex')).toContain(
      '        InvoicePersonalFields,\n        CustomerPersonalFields,\n        // /ddd-ts-kit:personal-fields',
    );

    expect(second.stdout).toContain(
      'joined the declarations of KnexBillingPersonalDataErasure and KnexBillingPersonalDataExport',
    );

    expect(read(root, EXPORTS).match(/BillingPersonalDataExport,/g)).toHaveLength(1);

    const spec = read(deleted, SPEC);

    expect(spec).toContain(
      "expect(await exported.exportOf('ada')).toEqual([{ source: SOURCE, values: EXPORTED_OF_ADA }]);",
    );

    expect(spec).toContain("expect(await exported.exportOf('ada')).toEqual([]);");
    expect(spec).not.toContain('EXPORTED_ERASED');
    expect(spec).toContain("const EXPORTED_OF_ADA = {\n  customer_email: 'customer_email of ada',");
    expect(spec).not.toContain('const EXPORTED_OF_ADA = {\n  customer_id');
  });
});

describe('the wiring of the export, in each family', () => {
  it('binds the port to the adapter in the module file of an explicit context, and lists the port among the exports', () => {
    const root = billingWithPersonalInvoices(['--orm', 'knex', '--style', 'explicit']);

    expect(read(root, `${BILLING}/billing.module.ts`)).toContain(
      "builder.bind(BillingPersonalDataExport).toClass(KnexBillingPersonalDataExport, [KnexContext]).as('repository');",
    );

    expect(exportAdapterOf(root, 'knex')).not.toContain('@Repository');
    expect(read(root, EXPORTS)).toContain('  BillingPersonalDataExport,\n');
  });

  it('instantiates the adapter from the platform where the contexts are wired by hand, wrapped like any other adapter', () => {
    const root = billingWithPersonalInvoices(['--orm', 'knex', '--di', 'manual']);
    const exports = read(root, EXPORTS);

    expect(exports).toContain(
      "import { KnexBillingPersonalDataExport } from '@/contexts/billing/infrastructure/persistence/knex-billing-personal-data-export.repository';",
    );

    expect(exports).toContain('platform.adapter(new KnexBillingPersonalDataExport(platform.persistence.database), {');
    expect(exports).toContain("token: 'BillingPersonalDataExport'");
    expect(read(root, `${BILLING}/billing.module.ts`)).not.toContain('PersonalDataExport');
    expect(checkJsonOf(cli(root, 'check', '--json')).violations).toEqual([]);
  });

  it('confines the export to the tenant of the work where the tables hold tenant data, and lists it again after init --force', () => {
    const tenants = billingWithPersonalInvoices(['--orm', 'knex', '--di', 'manual', '--tenancy', 'shared-table']);
    const tsyringe = billingWithPersonalInvoices(['--orm', 'knex']);
    const adapter = exportAdapterOf(tenants, 'knex');

    expect(adapter).toContain('  constructor(database: KnexContext, scope: ExecutionScope) {');
    expect(adapter).toContain('      tenant: scope,\n');

    expect(read(tenants, SPEC)).toContain(
      'exported = new KnexBillingPersonalDataExport(database.persistence.database, scope);',
    );

    expectOk(cli(tenants, 'init', '--force', '--orm', 'knex', '--di', 'manual', '--tenancy', 'shared-table'));
    expectOk(cli(tsyringe, 'init', '--force', '--orm', 'knex'));

    expect(read(tenants, EXPORTS)).toContain(
      'platform.adapter(new KnexBillingPersonalDataExport(platform.persistence.database, platform.scope), {',
    );

    expect(read(tsyringe, EXPORTS)).toContain(
      '  // ddd-ts-kit:exports\n  BillingPersonalDataExport,\n  // /ddd-ts-kit:exports',
    );

    expect(read(tsyringe, EXPORTS).match(/BillingPersonalDataExport/g)).toHaveLength(2);
  });
});
