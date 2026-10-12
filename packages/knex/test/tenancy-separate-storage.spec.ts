import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import knex, { type Knex } from 'knex';
import {
  AsyncLocalStorageExecutionScope,
  InMemoryTenantDirectory,
  InvalidTenantIdError,
  NoCurrentTenantError,
} from '@ddd-ts-kit/kernel';
import { anExecutionContext, asTenant, scoped } from '@ddd-ts-kit/testing';
import { tenantIsolationContract } from '@ddd-ts-kit/testing/contracts';
import {
  CrossTenantUnitOfWorkError,
  InvalidTenantIdentifierError,
  StatementOutsideUnitOfWorkError,
  TenantDatabases,
  auditColumns,
  createKnexUnitOfWork,
  createTenantRoutedUnitOfWork,
  migrateEveryTenant,
  migrateTenantSchema,
  tenantColumn,
  tenantOfMigration,
  tenantSchemaOf,
  tenantSearchPath,
} from '../src/index.js';
import { Invoice } from './support/billing-core/domain/invoice.js';
import { BILLING } from './support/billing-core/infrastructure/persistence/billing-schema.js';
import { createInvoicesTable } from './support/billing-core/infrastructure/persistence/create-invoices-table.js';
import { createDatabase, type TestDatabase } from './support/database.js';
import { startPostgres, type TestPostgres } from './support/postgres.js';
import { DATABASE_PER_TENANT, SCHEMA_PER_TENANT } from './support/tenancy/invoice-tables.js';
import { inUnitOfWork } from './support/tenancy/in-unit-of-work.js';
import { StrategyInvoiceRepository } from './support/tenancy/strategy-invoice-repository.js';

const runner = { describe, it, expect, beforeEach, afterEach };
const TENANTS = ['acme', 'globex'];

/** The tenant migrations, as a project keeps them in a directory of their own: each names its schema from the tenant. */
const tenantMigrations: Knex.MigrationSource<string> = {
  getMigrations: async () => ['20260301000000_invoices'],
  getMigrationName: (name) => name,
  getMigration: async () => ({
    up: async (migrating: Knex) => {
      const schema = tenantSchemaOf(BILLING, tenantOfMigration(migrating));

      await migrating.schema.createSchemaIfNotExists(schema);

      await migrating.schema.withSchema(schema).createTable('invoices', (table) => {
        table.text('id').primary();
        table.integer('amount').notNullable();
        table.text('status').notNullable();
        table.integer('version').notNullable();
        tenantColumn(table);
        auditColumns(table);
      });
    },
    down: async () => undefined,
  }),
};

let schemas: TestDatabase;
let servers: TestPostgres[];
let databases: TenantDatabases;
let next = 0;

beforeAll(async () => {
  schemas = await createDatabase(
    async (migrating) => {
      for (const tenantId of TENANTS) {
        await migrateTenantSchema(migrating, tenantId, { migrationSource: tenantMigrations });
      }
    },
    TENANTS.map((tenantId) => `${tenantSchemaOf(BILLING, tenantId)}.invoices`),
  );

  servers = await Promise.all(TENANTS.map(() => startPostgres()));
  databases = new TenantDatabases({ connectionOf: (tenantId) => connectionOf(servers[TENANTS.indexOf(tenantId)]) });

  await migrateEveryTenant(databases, new InMemoryTenantDirectory(TENANTS), (tenantKnex) =>
    createInvoicesTable(tenantKnex),
  );
  // Three databases to start: more than the default ten seconds on a loaded runner.
}, 60_000);

afterAll(async () => {
  await databases.close();
  await Promise.all(servers.map((server) => server.stop()));
  await schemas.close();
});

const invoices = {
  createAggregate: () => Invoice.draft(`inv-${(next += 1)}`, 100),
  recreate: (invoice: Invoice) => Invoice.draft(invoice.id, 100),
  mutate: (invoice: Invoice) => invoice.addCharge(50),
  idOf: (invoice: Invoice) => invoice.id,
  stateOf: (invoice: Invoice) => invoice.state,
};

tenantIsolationContract<Invoice>(runner, {
  ...invoices,
  name: 'knex, schema per tenant',
  createRepository: async (scope) => {
    await schemas.truncate();

    return new StrategyInvoiceRepository({
      context: createKnexUnitOfWork(schemas.knex),
      scope,
      tables: SCHEMA_PER_TENANT,
    });
  },
});

tenantIsolationContract<Invoice>(runner, {
  ...invoices,
  name: 'knex, database per tenant',
  createRepository: async (scope) => {
    for (const tenantId of TENANTS) {
      await databases.lease(tenantId, (database) => database.withSchema(BILLING).table('invoices').truncate());
    }

    const context = createTenantRoutedUnitOfWork(databases, scope);

    return inUnitOfWork(new StrategyInvoiceRepository({ context, scope, tables: DATABASE_PER_TENANT }), context);
  },
});

describe('schema per tenant', () => {
  it('names the schema of a tenant, and refuses a tenant id it would have to alter', () => {
    expect(tenantSchemaOf('billing', 'acme')).toBe('billing__acme');
    expect(tenantSchemaOf('billing', '0b5f-9c1d_A')).toBe('billing__0b5f-9c1d_A');
    expect(() => tenantSchemaOf('billing', 'acme"; drop')).toThrow(InvalidTenantIdentifierError);
    expect(() => tenantSchemaOf('billing', '')).toThrow(InvalidTenantIdentifierError);
    expect(() => tenantSchemaOf('billing', 'x'.repeat(60))).toThrow('longer than 63 characters');
  });

  it('records the migrations of each tenant in its own schema, and applies them once', async () => {
    await migrateTenantSchema(schemas.knex, 'acme', { migrationSource: tenantMigrations });

    const applied = await schemas.knex.withSchema('migrations__acme').table('knex_migrations').select('name');

    expect(applied).toEqual([{ name: '20260301000000_invoices' }]);

    await expect(schemas.knex.migrate.latest({ migrationSource: tenantMigrations })).rejects.toThrow(
      'applied per tenant',
    );
  });

  it('sets the search path of a transaction to the schemas of its tenant, and to none without one', async () => {
    const scope = new AsyncLocalStorageExecutionScope();
    const unitOfWork = createKnexUnitOfWork(schemas.knex, undefined, { begin: tenantSearchPath(scope, [BILLING]) });

    const path = () =>
      unitOfWork.run(async () => {
        const answered = await unitOfWork.executor().raw<{ rows: { search_path: string }[] }>('show search_path');

        return answered.rows[0]?.search_path;
      });

    expect(await asTenant(scope, 'acme', path)).toBe(`"${tenantSchemaOf(BILLING, 'acme')}"`);
    expect(await scoped(scope, anExecutionContext(), path)).toBe('""');
  });
});

describe('database per tenant', () => {
  const boundedTo = (maxTenants: number, opened: string[] = []) =>
    new TenantDatabases({
      connectionOf: () => ({ ...connectionOf(servers[0]), pool: { min: 0, max: 1 } }),
      maxTenants,
      open: (config) => {
        opened.push(String(config.client));

        return knex(config);
      },
    });

  it('keeps a bounded number of pools open, closing the least recently used once idle', async () => {
    const opened: string[] = [];
    const bounded = boundedTo(1, opened);
    const ping = (database: Knex) => database.raw('select 1');

    await bounded.lease('acme', ping);
    await bounded.lease('globex', ping);
    expect(bounded.tenants()).toEqual(['globex']);

    await bounded.lease('acme', ping);
    expect(bounded.tenants()).toEqual(['acme']);
    expect(opened).toHaveLength(3);
    await expect(bounded.lease('../etc', ping)).rejects.toThrow(InvalidTenantIdError);

    await bounded.close();
  });

  it('makes more active tenants than the bound wait, and never closes a pool in use', async () => {
    const bounded = boundedTo(2);
    const holding = new Set<string>();
    let most = 0;

    const work = (tenantId: string) =>
      bounded.lease(tenantId, async (database) => {
        holding.add(tenantId);
        most = Math.max(most, holding.size);
        await database.raw('select pg_sleep(0.02)');
        await database.raw('select 1');
        holding.delete(tenantId);

        return tenantId;
      });

    const tenants = ['acme', 'globex', 'initech', 'umbrella'];
    const done = await Promise.all([...tenants, ...tenants].map(work));

    expect(done).toEqual([...tenants, ...tenants]);
    expect(most).toBeLessThanOrEqual(2);
    expect(bounded.tenants().length).toBeLessThanOrEqual(2);

    await bounded.close();
  });

  it('refuses a statement outside of a transaction, and work of another tenant inside one', async () => {
    const scope = new AsyncLocalStorageExecutionScope();
    const unitOfWork = createTenantRoutedUnitOfWork(databases, scope);

    await expect(asTenant(scope, 'acme', async () => unitOfWork.executor())).rejects.toThrow(
      StatementOutsideUnitOfWorkError,
    );

    const crossing = asTenant(scope, 'acme', () =>
      unitOfWork.run(() => asTenant(scope, 'globex', () => unitOfWork.run(async () => 1))),
    );

    await expect(crossing).rejects.toThrow(CrossTenantUnitOfWorkError);
    expect(await asTenant(scope, 'acme', () => unitOfWork.run(() => unitOfWork.run(async () => 2)))).toBe(2);
  });

  it('reaches no database for work that names no tenant', async () => {
    const scope = new AsyncLocalStorageExecutionScope();
    const unitOfWork = createTenantRoutedUnitOfWork(databases, scope);

    await expect(scoped(scope, anExecutionContext(), () => unitOfWork.run(async () => 1))).rejects.toThrow(
      NoCurrentTenantError,
    );
  });

  it('stops at the tenant whose migration fails, and names it', async () => {
    const failing = migrateEveryTenant(databases, new InMemoryTenantDirectory(TENANTS), async (_, tenantId) => {
      if (tenantId === 'globex') {
        throw new Error('broken');
      }
    });

    await expect(failing).rejects.toThrow('The migration of tenant "globex" failed');
  });
});

function connectionOf(server: TestPostgres | undefined): Knex.Config {
  if (server === undefined) {
    throw new Error('No server for this tenant');
  }

  return { client: 'pg', connection: server.url, pool: { min: 0, max: server.poolSize } };
}
