import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import type { SQL } from 'drizzle-orm';
import { PgDialect, getTableConfig } from 'drizzle-orm/pg-core';
import { drizzle, type PgliteQueryResultHKT } from 'drizzle-orm/pglite';
import {
  AsyncLocalStorageExecutionScope,
  InvalidTenantIdError,
  NoCurrentTenantError,
  TENANT_ISOLATION_POLICIES,
  type UnitOfWork,
} from '@ddd-ts-kit/kernel';
import { anExecutionContext, asTenant, scoped } from '@ddd-ts-kit/testing';
import { tenantIsolationContract, type CriteriaContractRow } from '@ddd-ts-kit/testing/contracts';
import {
  ConcurrencyError,
  DrizzleReadModelTable,
  createDrizzleUnitOfWork,
  forceRowLevelSecurity,
  tenantPolicies,
  tenantSession,
} from '../src/postgres';
import { Invoice } from './support/billing-core/domain/invoice';
import type { InvoiceRepository } from './support/billing-core/domain/repositories/invoice.repository';
import { invoices } from './support/billing-core/infrastructure/persistence/invoices';
import { createTableSql } from './support/create-table-sql';
import { CONTRACT_TABLE, contractRows } from './support/read-model/criteria-contract-table';
import { TenantInvoiceRepository } from './support/tenancy/tenant-invoice.repository';

const runner = { describe, it, expect, beforeEach, afterEach };
const dialect = new PgDialect();

const render = (fragment: SQL | undefined): string =>
  fragment === undefined ? '' : dialect.sqlToQuery(fragment.inlineParams()).sql;

/** The policies as drizzle-kit would write them from `tenantPolicies`, then the statement it does not write. */
function rowLevelSecurityOf(): string[] {
  const { schema, name } = getTableConfig(invoices);
  const table = `"${schema ?? 'public'}"."${name}"`;

  const policies = tenantPolicies(invoices.tenantId).map((policy) => {
    const using = policy.using === undefined ? '' : ` using (${render(policy.using)})`;
    const withCheck = policy.withCheck === undefined ? '' : ` with check (${render(policy.withCheck)})`;

    return `create policy "${policy.name}" on ${table} as permissive for ${policy.for ?? 'all'}${using}${withCheck}`;
  });

  return [`alter table ${table} enable row level security`, ...policies, forceRowLevelSecurity(invoices)];
}

/** Shared tables, then the same tables under row-level security, each in a PGlite of its own. */
async function databaseOf(rowLevelSecurity: boolean) {
  const client = new PGlite();

  for (const statement of [...createTableSql(invoices), ...createTableSql(contractRows)]) {
    await client.exec(statement);
  }

  if (rowLevelSecurity) {
    for (const statement of [
      ...rowLevelSecurityOf(),
      'create role tenant_app',
      'grant usage on schema billing_core to tenant_app',
      'grant all privileges on all tables in schema billing_core to tenant_app',
      'set role tenant_app',
    ]) {
      await client.exec(statement);
    }
  }

  return { client, db: drizzle(client) };
}

let shared: Awaited<ReturnType<typeof databaseOf>>;
let secured: Awaited<ReturnType<typeof databaseOf>>;
let next = 0;

beforeAll(async () => {
  shared = await databaseOf(false);
  secured = await databaseOf(true);
  // Two databases to start: more than the default ten seconds on a loaded runner.
}, 60_000);

afterAll(async () => {
  await shared.client.close();
  await secured.client.close();
});

const invoiceCases = {
  createAggregate: () => Invoice.draft(`inv-${(next += 1)}`, 100),
  recreate: (invoice: Invoice) => Invoice.draft(invoice.id, 100),
  mutate: (invoice: Invoice) => invoice.addCharge(50),
  idOf: (invoice: Invoice) => invoice.id,
  stateOf: (invoice: Invoice) => invoice.state,
  elevatedReads: true,
};

tenantIsolationContract<Invoice>(runner, {
  ...invoiceCases,
  name: 'drizzle, shared tables',
  createRepository: async (scope) => {
    await shared.client.exec('truncate table billing_core.invoices');

    return new TenantInvoiceRepository(createDrizzleUnitOfWork(shared.db), scope);
  },
});

tenantIsolationContract<Invoice>(runner, {
  ...invoiceCases,
  name: 'drizzle, shared tables under row-level security',
  createRepository: async (scope) => {
    await secured.client.exec('truncate table billing_core.invoices');

    const unitOfWork = createDrizzleUnitOfWork(secured.db, undefined, { begin: tenantSession(scope) });

    return inUnitOfWork(new TenantInvoiceRepository(unitOfWork, scope), unitOfWork);
  },
});

tenantIsolationContract<Invoice>(runner, {
  ...invoiceCases,
  name: 'drizzle, row-level security alone, statements without a tenant condition',
  createRepository: async (scope) => {
    await secured.client.exec('truncate table billing_core.invoices');

    const unitOfWork = createDrizzleUnitOfWork(secured.db, undefined, { begin: tenantSession(scope) });

    return inUnitOfWork(new TenantInvoiceRepository(unitOfWork, scope, true), unitOfWork);
  },
});

describe('row-level security on drizzle', () => {
  const scope = new AsyncLocalStorageExecutionScope();
  const unitOfWork = () => createDrizzleUnitOfWork(secured.db, undefined, { begin: tenantSession(scope) });

  beforeEach(async () => {
    await secured.client.exec('truncate table billing_core.invoices');

    for (const tenantId of ['acme', 'globex']) {
      const context = unitOfWork();
      const seeded = Invoice.draft(`inv-${tenantId}`, 1);

      await asTenant(scope, tenantId, () =>
        context.run(() => new TenantInvoiceRepository(context, scope).save(seeded)),
      );
    }
  });

  it('shows a statement without a tenant condition the rows of its tenant only, and nothing outside of a transaction', async () => {
    const context = unitOfWork();

    const ids = await asTenant(scope, 'acme', () =>
      context.run(() => context.executor().select({ id: invoices.id }).from(invoices)),
    );

    expect(ids).toEqual([{ id: 'inv-acme' }]);
    expect(await asTenant(scope, 'acme', () => secured.db.select({ id: invoices.id }).from(invoices))).toEqual([]);
  });

  it('lets an elevated statement read every reached tenant, and update or delete none but its own', async () => {
    const elevated = anExecutionContext().ofTenant('initech').elevatedOver('all');
    const context = unitOfWork();

    const seen = await scoped(scope, elevated, () =>
      context.run(async () => {
        await context.executor().update(invoices).set({ tenantId: 'initech', amount: 0 });
        await context.executor().delete(invoices);

        return context
          .executor()
          .select({ id: invoices.id, amount: invoices.amount })
          .from(invoices)
          .orderBy(invoices.id);
      }),
    );

    expect(seen).toEqual([
      { id: 'inv-acme', amount: 1 },
      { id: 'inv-globex', amount: 1 },
    ]);
  });

  it('refuses a context whose tenant id could widen the reach, before any SQL', async () => {
    for (const tenantId of ['*', 'acme,globex', 'acme:products']) {
      const context = unitOfWork();
      const forged = { ...anExecutionContext().build(), tenantId };

      await expect(scoped(scope, forged, () => context.run(async () => undefined))).rejects.toThrow(
        InvalidTenantIdError,
      );
    }
  });

  it('declares one policy per command, which drizzle-kit generates, and forces them on the owner', () => {
    const policies = tenantPolicies(invoices.tenantId);
    const write = `"tenant_id" = current_setting('ddd_ts_kit.tenant_id', true)`;

    expect(policies.map((policy) => [policy.name, policy.for])).toEqual([
      [TENANT_ISOLATION_POLICIES.select, 'select'],
      [TENANT_ISOLATION_POLICIES.insert, 'insert'],
      [TENANT_ISOLATION_POLICIES.update, 'update'],
      [TENANT_ISOLATION_POLICIES.delete, 'delete'],
    ]);

    expect(render(policies[3]?.using)).toBe(write);
    expect(forceRowLevelSecurity(invoices)).toBe('alter table "billing_core"."invoices" force row level security;');
  });
});

describe('tenant conditions on drizzle', () => {
  const scope = new AsyncLocalStorageExecutionScope();
  const repository = () => new TenantInvoiceRepository(createDrizzleUnitOfWork(shared.db), scope);

  beforeEach(async () => {
    await shared.client.exec('truncate table billing_core.invoices, read_side.criteria_contract');
  });

  it('widen the reads of an elevation, and never its writes', async () => {
    await asTenant(scope, 'acme', () => repository().save(Invoice.draft('inv-acme', 1)));
    await asTenant(scope, 'globex', () => repository().save(Invoice.draft('inv-globex', 2)));

    const staff = anExecutionContext().ofTenant('initech');
    const found = await scoped(scope, staff.elevatedOver(['acme']), () => repository().findById('inv-acme'));
    const hidden = await scoped(scope, staff.elevatedOver(['acme']), () => repository().findById('inv-globex'));

    expect(found?.id).toBe('inv-acme');
    expect(hidden).toBeUndefined();

    found?.addCharge(1);

    await expect(
      scoped(scope, staff.elevatedOver('all'), () => repository().save(found ?? Invoice.draft('x', 1))),
    ).rejects.toThrow(ConcurrencyError);
  });

  it('keep each row of a read model of tenant data in its tenant', async () => {
    const stamp = { eventId: 'evt-1', occurredAt: new Date('2026-10-10T12:00:00.000Z') };

    const row: CriteriaContractRow = {
      id: 'a1',
      status: 'booked',
      title: 't',
      seats: 1,
      price: '1',
      startsAt: stamp.occurredAt,
      cancelledAt: null,
      room: null,
      remote: false,
      tenantId: 'globex',
    };

    const table = () =>
      new DrizzleReadModelTable<CriteriaContractRow, PgliteQueryResultHKT>(createDrizzleUnitOfWork(shared.db), {
        ...CONTRACT_TABLE,
        tenant: { scope, column: contractRows.tenantId },
      });

    const plan = {
      empty: false,
      fields: {},
      filter: undefined,
      seek: undefined,
      sort: [],
      kind: 'offset',
      limit: 10,
      fetch: 10,
      offset: 0,
    } as const;

    await asTenant(scope, 'acme', () => table().insert({ key: 'a1', row, stamp }));

    expect((await asTenant(scope, 'acme', () => table().find('a1')))?.row?.tenantId).toBe('acme');
    expect(await asTenant(scope, 'globex', () => table().find('a1'))).toBeUndefined();
    expect(await asTenant(scope, 'globex', () => table().replace({ key: 'a1', row, stamp }, stamp))).toBe(false);
    expect((await asTenant(scope, 'globex', () => table().search(plan))).rows).toEqual([]);
    expect((await asTenant(scope, 'acme', () => table().search(plan))).rows).toHaveLength(1);
    await expect(scoped(scope, anExecutionContext(), () => table().find('a1'))).rejects.toThrow(NoCurrentTenantError);
  });
});

/** Each call in a transaction of the unit of work, as the bus middleware runs commands and queries. */
function inUnitOfWork(repository: InvoiceRepository, unitOfWork: UnitOfWork): InvoiceRepository {
  return {
    findById: (id) => unitOfWork.run(() => repository.findById(id)),
    save: (invoice) => unitOfWork.run(() => repository.save(invoice)),
  };
}
