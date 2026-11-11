import { describe, expect, it } from 'vitest';
import { checkJsonOf } from './check-support';
import { cli, read } from './helpers';
import { report } from './reports';
import { billingProject, BILLING, CONTRACT, PERSISTENCE, withInvoiceSummaries } from './support/read-model-project';

const SCHEMA = `${PERSISTENCE}/billing.schema.ts`;

/** What each ORM writes for a read model of tenant data: in its table, and in the options of its store. */
const TENANT_DATA = [
  [
    'drizzle',
    SCHEMA,
    "    ...tenantColumn(),\n    ...readModelColumns(),\n  },\n  (table) => [\n    index('invoice_summaries_tenant_idx').on(table.tenantId, table.id),\n    check(\n",
    `${PERSISTENCE}/drizzle-invoice-summaries.repository.ts`,
    '      tenant: { scope, column: invoiceSummaries.tenantId },',
  ],
  [
    'knex',
    `${PERSISTENCE}/create-billing-tables.schema.ts`,
    "    tenantColumn(table);\n    table.index(['tenant_id', 'id'], 'invoice_summaries_tenant_idx');\n    readModelColumns(table);\n\n    table.check(\n",
    `${PERSISTENCE}/knex-invoice-summaries.repository.ts`,
    '      tenant: scope,',
  ],
  [
    'prisma',
    'prisma/schema/billing.prisma',
    '  tenantId String @map("tenant_id")\n',
    `${PERSISTENCE}/prisma-invoice-summaries.repository.ts`,
    '      tenant: { scope },',
  ],
  [
    'typeorm',
    SCHEMA,
    "    tenantId: { ...tenantColumn().tenantId, select: false },\n    ...readModelColumns(),\n  },\n  indices: [{ name: 'invoice_summaries_tenant_idx', columns: ['tenantId', 'id'] }],\n  checks: [\n",
    `${PERSISTENCE}/type-orm-invoice-summaries.repository.ts`,
    'tenant: { scope }, definition: invoiceSummariesCriteria });',
  ],
] as const;

describe.each(TENANT_DATA)('generate read-model --tenant-scoped, on %s', (orm, tables, column, adapter, option) => {
  const root = billingProject('--orm', orm);

  withInvoiceSummaries(root, '--tenant-scoped');

  it('gives the table the tenant column and its index, and the store the scope of the work', () => {
    expect(read(root, tables)).toContain(column);
    expect(read(root, adapter)).toContain(', scope: ExecutionScope) {');
    expect(read(root, adapter)).toContain(option);
  });

  it('proves in the contract that a tenant does not read what another wrote', () => {
    const contract = read(root, CONTRACT);

    expect(contract).toContain("(database.persistence.database, new FixedExecutionScope(workOf('acme')));");
    expect(contract).toContain("  it('hides from a tenant what another tenant wrote', async () => {");

    expect(contract).toContain(
      "    scope.enter(workOf('globex'));\n\n    expect(await store.get('row-1')).toBeUndefined();",
    );
  });

  it('passes the checker with no finding', () => {
    expect(checkJsonOf(cli(root, 'check', '--json')).violations).toEqual([]);
  });
});

describe('generate read-model, in a multi-tenant project', () => {
  it('writes tenant data without the flag, and injects the scope where the dependencies are declared', () => {
    const root = billingProject('--tenancy', 'shared-table');

    withInvoiceSummaries(root);

    expect(read(root, SCHEMA)).toContain('    ...tenantColumn(),');

    expect(read(root, `${BILLING}/infrastructure/infrastructure.declarations.ts`)).toContain(
      'injected(DrizzleInvoiceSummaries, [Database, ExecutionScope]);',
    );

    expect(checkJsonOf(cli(root, 'check', '--json')).violations).toEqual([]);
  });

  it('keeps a typed entity on TypeORM, whose tenant stays out of the rows', () => {
    const root = billingProject('--orm', 'typeorm', '--tenancy', 'shared-table');
    const generated = report(withInvoiceSummaries(root));

    expect(generated.notes.join('\n')).toContain('db:generate migrations/<what-it-does>');

    expect(read(root, SCHEMA)).toContain('new EntitySchema<InvoiceSummariesRow & TenantScoped & ReadModelStamps>({');
  });
});
