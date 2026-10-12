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

const DRIZZLE_SCOPED = `import { tenantCondition } from '@ddd-ts-kit/drizzle/postgres';

export class DrizzleInvoiceRepository {
  findById(id: string) {
    return this.database.executor().select().from(invoices).where(and(eq(invoices.id, id), tenantCondition(invoices.tenantId, this.scope)));
  }
}
`;

const DRIZZLE_UNSCOPED = `export class DrizzleInvoiceRepository {
  findById(id: string) {
    return this.database.executor().select().from(invoices).where(eq(invoices.id, id));
  }
}
`;

const tenancy = (orm: string, value = 'shared-table') => ({
  [CONFIG_FILE]: config({ stack: { orm, tenancy: value } }),
});

export const TENANCY_FIXTURES: readonly Fixture[] = [
  {
    ruleId: RULE,
    name: 'knex and drizzle adapters reaching tenant data through the helpers',
    expect: 'pass',
    files: project(
      { [KNEX_ADAPTER]: KNEX_SCOPED, [DRIZZLE_ADAPTER]: DRIZZLE_SCOPED.replace('drizzle', 'knex') },
      tenancy('knex'),
    ),
  },
  {
    ruleId: RULE,
    name: 'a knex table reached straight from the executor on shared tables',
    expect: { file: KNEX_ADAPTER },
    files: project({ [KNEX_ADAPTER]: KNEX_UNSCOPED }, tenancy('knex')),
  },
  {
    ruleId: RULE,
    name: 'a drizzle adapter that writes no tenant condition',
    expect: { file: DRIZZLE_ADAPTER },
    files: project({ [DRIZZLE_ADAPTER]: DRIZZLE_UNSCOPED }, tenancy('drizzle')),
  },
  {
    ruleId: RULE,
    name: 'a drizzle adapter with its tenant condition',
    expect: 'pass',
    files: project({ [DRIZZLE_ADAPTER]: DRIZZLE_SCOPED }, tenancy('drizzle')),
  },
  {
    ruleId: RULE,
    name: 'a project of one customer, which says nothing of tenancy',
    expect: 'pass',
    files: project({ [KNEX_ADAPTER]: KNEX_UNSCOPED }, { [CONFIG_FILE]: config({ stack: { orm: 'knex' } }) }),
  },
];
