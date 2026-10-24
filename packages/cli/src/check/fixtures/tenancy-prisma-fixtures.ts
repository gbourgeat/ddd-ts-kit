import type { Fixture } from './fixture';
import { PATHS } from './paths';
import { project } from './project';
import { tenancyBypass } from './tenancy-bypass';
import { tenancyConfig } from './tenancy-config';

const RULE = 'tenancy/scoped-statement';
const PRISMA_ADAPTER = `${PATHS.BILLING}/infrastructure/persistence/prisma-invoice.repository.ts`;
const PRISMA_READ_MODEL = `${PATHS.BILLING}/infrastructure/persistence/prisma-invoice-totals.repository.ts`;

/** Every statement on the client confined: the where spreads a helper, inline or through a local, the created row names its tenant. */
const PRISMA_SCOPED = `import { ownTenantWhere, tenantWhere } from '@ddd-ts-kit/prisma';
import { tenantScopeOf } from '@ddd-ts-kit/kernel';

export class PrismaInvoiceRepository {
  findById(id: string) {
    return this.database.client().invoice.findFirst({ where: { id, ...tenantWhere(this.scope) } });
  }

  search() {
    const where = tenantWhere(this.scope);

    return this.database.client().invoice.findMany({ where, take: 20 });
  }

  insert(state: InvoiceState) {
    const row = { ...state, ...tenantScopeOf(this.scope) };

    return this.database.client().invoice.createMany({ data: [row], skipDuplicates: true });
  }

  update(state: InvoiceState, expected: number) {
    const mine = { id: state.id, version: expected, ...ownTenantWhere(this.scope) };

    return this.database.client().invoice.updateMany({ where: mine, data: state });
  }
}
`;

const PRISMA_UNSCOPED = `export class PrismaInvoiceRepository {
  findById(id: string) {
    return this.database.client().invoice.findFirst({ where: { id } });
  }
}
`;

/** What the rule says of a Prisma adapter: the statements on the client, and a read model store without its tenant. */
export const TENANCY_PRISMA_FIXTURES: readonly Fixture[] = [
  {
    ruleId: RULE,
    name: 'a prisma adapter with the helpers spread into every statement, inline or through a local',
    expect: 'pass',
    files: project({ [PRISMA_ADAPTER]: PRISMA_SCOPED }, tenancyConfig('prisma')),
  },
  {
    ruleId: RULE,
    name: 'a prisma adapter that reads with no tenant condition',
    expect: { file: PRISMA_ADAPTER },
    files: project({ [PRISMA_ADAPTER]: PRISMA_UNSCOPED }, tenancyConfig('prisma')),
  },
  tenancyBypass(
    'prisma',
    'a row reached by its key',
    'return this.database.client().invoice.findUnique({ where: { id } });',
  ),
  tenancyBypass(
    'prisma',
    'an upsert',
    'return this.database.client().invoice.upsert({ where: { id }, create: state, update: state });',
  ),
  tenancyBypass(
    'prisma',
    'a write confined by the condition of a read only',
    'return this.database.client().invoice.updateMany({ where: { id, ...tenantWhere(this.scope) }, data });',
  ),
  tenancyBypass(
    'prisma',
    'an insert that names no tenant',
    'return this.database.client().invoice.createMany({ data: [state], skipDuplicates: true });',
  ),
  tenancyBypass(
    'prisma',
    'a count with no tenant condition',
    "return this.database.client().invoice.count({ where: { status: 'issued' } });",
  ),
  tenancyBypass('prisma', 'raw SQL', 'return this.database.client().$queryRaw`select * from billing.invoices`;'),
  tenancyBypass(
    'prisma',
    'the client held in a variable',
    'const client = this.database.client();\n\n    return client.invoice.findFirst({ where: { id, ...tenantWhere(this.scope) } });',
  ),
  tenancyBypass(
    'prisma',
    'a where held in a local that names no tenant',
    'const where = { id };\n\n    return this.database.client().invoice.findFirst({ where });',
  ),
  {
    ruleId: RULE,
    name: 'read model store on prisma built without its tenant',
    expect: { file: PRISMA_READ_MODEL },
    files: project(
      {
        [PRISMA_READ_MODEL]:
          'export class PrismaInvoiceTotals extends PrismaReadModelStore<Total, Prisma.TransactionClient> {\n  constructor(database: Database) {\n    super(database, { ...TOTALS, definition });\n  }\n}\n',
      },
      tenancyConfig('prisma'),
    ),
  },
];
