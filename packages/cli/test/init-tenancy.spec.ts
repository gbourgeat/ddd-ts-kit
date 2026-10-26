import { describe, expect, it } from 'vitest';
import { cli, read } from './helpers';
import { initFailure } from './support/init-failure';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';
import { readJson } from './support/read-json';

const CONFIG = 'ddd-ts-kit.config.json';
const SHARED = ['--tenancy', 'shared-table', '--context', 'billing:core'];

describe('init --tenancy', () => {
  it('records shared tables, and says nothing of tenancy for a project of one customer', () => {
    expect(jsonAt(readJson(initProject('--tenancy', 'shared-table'), CONFIG), 'stack', 'tenancy')).toBe('shared-table');
    expect(jsonAt(readJson(initProject(), CONFIG), 'stack')).not.toHaveProperty('tenancy');
    expect(cli(initProject(), '--help').stdout).toContain('[--tenancy none|shared-table]');
  });

  it('keeps the tenant of each event in the outbox', () => {
    const knex = initProject('--orm', 'knex', ...SHARED);
    const drizzle = initProject(...SHARED);
    const prisma = initProject('--orm', 'prisma', ...SHARED);
    const typeorm = initProject('--orm', 'typeorm', ...SHARED);

    expect(read(knex, 'src/platform/database/schema.ts')).toContain(
      'createOutboxTables(knex, { schema: MESSAGING_SCHEMA, tenant: true })',
    );

    expect(read(knex, 'src/platform/database/persistence-over.ts')).toContain(
      '{ schema: MESSAGING_SCHEMA, tenant: true }',
    );

    expect(read(drizzle, 'src/platform/database/schema.ts')).toContain(
      'export const outbox = tenantOutboxTable(MESSAGING_SCHEMA);',
    );

    expect(read(prisma, 'prisma/schema.prisma')).toContain('  tenantId      String?   @map("tenant_id")\n');
    expect(read(prisma, 'src/platform/database/persistence-over.ts')).toContain('      tenant: true,\n    }),');
    expect(read(prisma, 'prisma/schema.prisma')).not.toContain('tenant_id") @db.VarChar');

    expect(read(typeorm, 'src/platform/database/schema.ts')).toContain(
      'export const outbox = outboxEntity({ schema: MESSAGING_SCHEMA, tenant: true });',
    );

    // The jobs table keeps a tenant in every project: the scope of an idempotency key, not a tenancy.
    const singleTenant = read(initProject('--orm', 'prisma', '--audit', 'off'), 'prisma/schema.prisma');

    expect(
      singleTenant.slice(singleTenant.indexOf('model OutboxRecord'), singleTenant.indexOf('model ProcessedEvent')),
    ).not.toContain('tenant_id');
  });

  it('generates every repository confined to the tenant through the helpers of the ORM', () => {
    const knex = initProject('--orm', 'knex', ...SHARED);
    const drizzle = initProject(...SHARED);

    for (const project of [knex, drizzle]) {
      cli(project, 'generate', 'aggregate', 'billing', 'Invoice', '--allow-name');
      cli(project, 'generate', 'repository', 'billing', 'Invoice', '--allow-name');
    }

    const knexAdapter = read(knex, 'src/contexts/billing/infrastructure/persistence/knex-invoice.repository.ts');

    const drizzleAdapter = read(
      drizzle,
      'src/contexts/billing/infrastructure/persistence/drizzle-invoice.repository.ts',
    );

    expect(knexAdapter).toContain('tenantTable<InvoiceRow>(this.database, this.scope, TABLE)');
    expect(knexAdapter).toContain('ownTenantTable<InvoiceRow>(this.database, this.scope, TABLE)');
    expect(knexAdapter).not.toContain('executor()<');
    expect(drizzleAdapter).toContain('tenantCondition(invoices.tenantId, this.scope)');
    expect(drizzleAdapter).toContain('ownTenantCondition(invoices.tenantId, this.scope)');
  });
});

describe('generate repository --tenant-scoped on a custom store', () => {
  it('says how to confine the statements by hand, since no ORM package carries the helpers', () => {
    const project = initProject('--orm', 'custom', '--context', 'billing:core');

    cli(project, 'generate', 'aggregate', 'billing', 'Invoice', '--allow-name');

    const generated = cli(
      project,
      'generate',
      'repository',
      'billing',
      'Invoice',
      '--allow-name',
      '--tenant-scoped',
      '--json',
    );

    expect(generated.stdout).toContain('--tenant-scoped is generated for drizzle, knex, prisma and typeorm only');
    expect(generated.stdout).toContain('with custom, add the tenant column to the storage');
  });
});

describe('init --tenancy on Prisma and TypeORM', () => {
  it('spreads the helpers into every statement of a Prisma or TypeORM repository, and names the tenant in the storage', () => {
    const prisma = initProject('--orm', 'prisma', ...SHARED);
    const typeorm = initProject('--orm', 'typeorm', ...SHARED);

    for (const project of [prisma, typeorm]) {
      cli(project, 'generate', 'aggregate', 'billing', 'Invoice', '--allow-name');
      cli(project, 'generate', 'repository', 'billing', 'Invoice', '--allow-name');
    }

    const prismaAdapter = read(prisma, 'src/contexts/billing/infrastructure/persistence/prisma-invoice.repository.ts');
    const model = read(prisma, 'prisma/schema.prisma');

    const typeormAdapter = read(
      typeorm,
      'src/contexts/billing/infrastructure/persistence/type-orm-invoice.repository.ts',
    );

    const schema = read(typeorm, 'src/contexts/billing/infrastructure/persistence/billing.schema.ts');

    expect(prismaAdapter).toContain('.findFirst({\n      where: { id, ...tenantWhere(this.scope) },\n    });');
    expect(prismaAdapter).toContain('where: { id: state.id, version: expected, ...ownTenantWhere(this.scope) },');

    expect(prismaAdapter).toContain(
      'const row = { ...state, ...tenantScopeOf(this.scope), ...stampCreation(this.scope, this.clock) };',
    );

    expect(prismaAdapter).not.toContain('.findUnique(');
    expect(model).toContain('  tenantId     String   @map("tenant_id")\n');
    expect(model).toContain('  @@index([tenantId, id], map: "invoices_tenant_idx")\n');

    expect(read(prisma, 'src/contexts/billing/infrastructure/persistence/invoice.mapper.ts')).toContain(
      "Omit<InvoiceRow, 'version' | keyof AuditStamp | keyof TenantScoped>",
    );

    expect(typeormAdapter).toContain('findOneBy(invoices, { id, ...tenantWhere(this.scope) })');

    expect(typeormAdapter).toContain(
      'const guarded = { id: state.id, version: expected, ...ownTenantWhere(this.scope) };',
    );

    expect(typeormAdapter).toContain(
      'const row = { ...state, ...tenantScopeOf(this.scope), ...stampCreation(this.scope, this.clock) };',
    );

    expect(schema).toContain("import { auditColumns, schemaNameOf, tenantColumn } from '@ddd-ts-kit/typeorm';");
    expect(schema).toContain('    ...tenantColumn(),\n    ...auditColumns(),');
    expect(schema).toContain("indices: [{ name: 'invoices_tenant_idx', columns: ['tenantId', 'id'] }],");

    expect(read(typeorm, 'src/contexts/billing/infrastructure/persistence/invoice-row.schema.ts')).toContain(
      'export interface InvoiceRow extends InvoiceColumns, TenantScoped, AuditStamp {',
    );
  });

  it('confines the search of the audit trail to the tenant of the work, never to the actor', () => {
    const declared = initProject('--orm', 'knex', ...SHARED);
    const explicit = initProject('--style', 'explicit', '--di', 'manual', ...SHARED);
    const single = initProject();
    const handler = 'src/platform/audit/search-audit-entries/search-audit-entries.handler.ts';

    expect(read(declared, 'src/platform/audit/create-audit.ts')).toContain(
      'reader: new TenantAuditReader(trail, source.scope),',
    );

    expect(read(declared, 'src/platform/audit/audit.module.ts')).toContain(
      'builder.bind(AuditReader).toValue(audit.reader);',
    );

    expect(read(explicit, 'src/platform/audit/audit.module.ts')).toContain(
      'new SearchAuditEntriesHandler(platform.audit.reader)',
    );

    expect(read(declared, handler)).toContain('return this.reader.search(query.filter, query.page);');
    expect(read(declared, handler)).not.toContain('query.actor');
    expect(read(single, handler)).toContain('const { tenantId } = query.actor;');
    expect(read(single, 'src/platform/audit/create-audit.ts')).not.toContain('TenantAuditReader');
  });

  it('refuses a project without an ORM package, and the strategies it does not generate yet', () => {
    const custom = initFailure('--orm', 'custom', '--tenancy', 'shared-table');
    const rowLevel = initFailure('--tenancy', 'row-level-security');
    const unknown = initFailure('--tenancy', 'per-tenant');

    expect(custom.message).toBe('--tenancy shared-table cannot be combined with --orm custom.');
    expect(custom.fix).toContain('knex, drizzle, prisma and typeorm');
    expect(rowLevel.message).toBe('--tenancy row-level-security is not generated by init yet.');
    expect(rowLevel.fix).toContain('tenantSession');
    expect(unknown.message).toBe('Unknown value "per-tenant" for --tenancy.');
  });
});
