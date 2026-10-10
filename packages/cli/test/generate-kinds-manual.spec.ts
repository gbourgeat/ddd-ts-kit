import { beforeAll, describe, expect, it } from 'vitest';
import { read, scaffoldEverything, tempDir, walk } from './helpers.js';

const BILLING = 'src/contexts/billing';

describe('a context wired by hand', () => {
  let root: string;

  beforeAll(() => {
    root = tempDir('manual');

    scaffoldEverything(root, {
      http: 'fastify',
      validation: 'class-validator',
      di: 'manual',
      tests: 'vitest',
      orm: 'knex',
      events: 'outbox',
    });
  });

  it('is a function of the platform, named after its file, that registers on the buses and answers what it declares', () => {
    const module = read(root, `${BILLING}/billing.module.ts`);

    expect(module).toContain("import type { Platform } from '../../platform/platform.js';");
    expect(module).toContain('export function billingModule(platform: Platform): BillingWiring {');

    expect(module).toContain(
      "const invoiceRepository = platform.adapter(\n    new KnexInvoiceRepository(platform.persistence.database, platform.scope, platform.clock),\n    { kind: 'repository', context: 'billing', token: 'InvoiceRepository' },\n  );\n\n  platform.commands.register(\n    IssueInvoiceCommand,",
    );

    expect(module).toContain("requires(IssueInvoiceCommand, billingPermissions['invoice.issue']),");
    expect(module).toContain('issueInvoiceRoute(platform.commands),');
    expect(module).toContain('  // /ddd-ts-kit:registrations\n\n  return {');

    expect(read(root, 'src/platform/compose-application.ts')).toContain(
      '  billingModule,\n  shippingModule,\n  orderFulfilmentModule,',
    );
  });

  it('names the context of knex in its repository, and keeps its rows and its tables in files named after them', () => {
    const persistence = `${BILLING}/infrastructure/persistence`;

    expect(walk(root, persistence)).toEqual([
      `${persistence}/billing.schema.ts`,
      `${persistence}/create-billing-tables.schema.ts`,
      `${persistence}/in-memory-search-invoices.reader.ts`,
      `${persistence}/invoice-row.schema.ts`,
      `${persistence}/invoice.mapper.ts`,
      `${persistence}/knex-invoice.repository.ts`,
    ]);

    expect(read(root, `${persistence}/knex-invoice.repository.ts`)).toContain(
      'private readonly database: KnexContext,',
    );

    expect(read(root, `${persistence}/knex-invoice.repository.ts`)).toContain(
      '\nfunction tableOf(database: KnexContext): Knex.QueryBuilder<InvoiceRow, InvoiceRow[]> {',
    );

    expect(read(root, `${persistence}/invoice-row.schema.ts`)).toContain(
      'export interface InvoiceRow extends InvoiceColumns, AuditRow {',
    );

    expect(read(root, `${persistence}/create-billing-tables.schema.ts`)).toContain(
      'export async function createBillingTables(knex: Knex): Promise<void> {',
    );

    expect(read(root, 'src/platform/database/schema.ts')).toContain(
      "from '../../contexts/billing/infrastructure/persistence/create-billing-tables.schema.js';",
    );
  });

  it('writes one class-validator class per file, each named after its class', () => {
    const http = `${BILLING}/presentation/http`;

    expect(walk(root, http).filter((file) => file.endsWith('.dto.ts'))).toEqual([
      `${http}/cancel-invoice-params.dto.ts`,
      `${http}/issue-invoice-accepted.dto.ts`,
      `${http}/issue-invoice-body.dto.ts`,
      `${http}/search-invoices-line.dto.ts`,
    ]);

    expect(read(root, `${http}/issue-invoice.route.ts`)).toContain(
      "import { IssueInvoiceBody } from './issue-invoice-body.dto.js';\nimport { IssueInvoiceAccepted } from './issue-invoice-accepted.dto.js';",
    );

    expect(read(root, `${BILLING}/published-language/invoice-issued.v1.payload.ts`)).toContain(
      'export class InvoiceIssuedV1Payload {',
    );

    expect(read(root, `${BILLING}/published-language/index.ts`)).toContain(
      "export * from './invoice-issued.v1.payload.js';\nexport * from './invoice-issued.v1.integration-event.js';",
    );
  });
});
