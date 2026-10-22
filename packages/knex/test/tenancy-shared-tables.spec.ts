import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AsyncLocalStorageExecutionScope, NoCurrentTenantError } from '@ddd-ts-kit/kernel';
import { anExecutionContext, asTenant, scoped } from '@ddd-ts-kit/testing';
import { tenantIsolationContract } from '@ddd-ts-kit/testing/contracts';
import type { CriteriaContractRow } from '@ddd-ts-kit/testing/contracts';
import { ConcurrencyError, KnexReadModelTable, createKnexUnitOfWork, tenantTable } from '../src';
import { Invoice } from './support/billing-core/domain/invoice';
import { BILLING } from './support/billing-core/infrastructure/persistence/billing-schema';
import { createInvoicesTable } from './support/billing-core/infrastructure/persistence/create-invoices-table';
import type { InvoiceRow } from './support/billing-core/infrastructure/persistence/invoice-row';
import { createDatabase, type TestDatabase } from './support/database';
import { CONTRACT_TABLE, READ_SIDE, createContractTable } from './support/read-model/criteria-contract-table';
import { SHARED_TABLES } from './support/tenancy/invoice-tables';
import { StrategyInvoiceRepository } from './support/tenancy/strategy-invoice-repository';

const runner = { describe, it, expect, beforeEach, afterEach };
const INVOICES = { table: 'invoices', schema: BILLING };

let database: TestDatabase;
let next = 0;

beforeAll(async () => {
  database = await createDatabase(
    async (knex) => {
      await createInvoicesTable(knex);
      await createContractTable(knex);
    },
    [`${BILLING}.invoices`, `${READ_SIDE}.${CONTRACT_TABLE.table}`],
  );
});

afterAll(async () => {
  await database.close();
});

const invoices = {
  createAggregate: () => Invoice.draft(`inv-${(next += 1)}`, 100),
  recreate: (invoice: Invoice) => Invoice.draft(invoice.id, 100),
  mutate: (invoice: Invoice) => invoice.addCharge(50),
  idOf: (invoice: Invoice) => invoice.id,
  stateOf: (invoice: Invoice) => invoice.state,
  elevatedReads: true,
};

tenantIsolationContract<Invoice>(runner, {
  ...invoices,
  name: 'knex, shared tables',
  createRepository: async (scope) => {
    await database.truncate();

    return new StrategyInvoiceRepository({
      context: createKnexUnitOfWork(database.knex),
      scope,
      tables: SHARED_TABLES,
    });
  },
});

describe('shared tables', () => {
  const scope = new AsyncLocalStorageExecutionScope();

  const repository = () =>
    new StrategyInvoiceRepository({ context: createKnexUnitOfWork(database.knex), scope, tables: SHARED_TABLES });

  beforeEach(async () => {
    await database.truncate();
  });

  it('widen the reads of an elevation to the tenants it names, and never its writes', async () => {
    const acme = Invoice.draft('inv-acme', 1);
    const globex = Invoice.draft('inv-globex', 2);

    await asTenant(scope, 'acme', () => repository().save(acme));
    await asTenant(scope, 'globex', () => repository().save(globex));

    const staff = anExecutionContext().ofTenant('initech');

    const read = (tenants: 'all' | readonly string[]) =>
      scoped(scope, staff.elevatedOver(tenants), () =>
        tenantTable<InvoiceRow>(createKnexUnitOfWork(database.knex), scope, INVOICES),
      );

    expect((await read('all')).map((row) => row.id).sort()).toEqual(['inv-acme', 'inv-globex']);
    expect((await read(['globex'])).map((row) => row.id)).toEqual(['inv-globex']);

    const elevated = await scoped(scope, staff.elevatedOver('all'), () => repository().findById('inv-acme'));

    elevated?.addCharge(1);

    await expect(scoped(scope, staff.elevatedOver('all'), () => repository().save(elevated ?? acme))).rejects.toThrow(
      ConcurrencyError,
    );
  });
});

describe('a read model of tenant data', () => {
  const scope = new AsyncLocalStorageExecutionScope();
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
    new KnexReadModelTable<CriteriaContractRow>(createKnexUnitOfWork(database.knex), {
      ...CONTRACT_TABLE,
      tenant: scope,
    });

  beforeEach(async () => {
    await database.truncate();
  });

  it('writes each row in the tenant of the work, and keeps it from the others', async () => {
    await asTenant(scope, 'acme', () => table().insert({ key: 'a1', row, stamp }));

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

    expect((await asTenant(scope, 'acme', () => table().find('a1')))?.row?.tenantId).toBe('acme');
    expect(await asTenant(scope, 'globex', () => table().find('a1'))).toBeUndefined();
    expect(await asTenant(scope, 'globex', () => table().replace({ key: 'a1', row, stamp }, stamp))).toBe(false);
    expect((await asTenant(scope, 'globex', () => table().search(plan))).rows).toEqual([]);
    expect((await asTenant(scope, 'acme', () => table().search(plan))).rows).toHaveLength(1);
    await expect(scoped(scope, anExecutionContext(), () => table().find('a1'))).rejects.toThrow(NoCurrentTenantError);
  });
});
