import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  AsyncLocalStorageExecutionScope,
  FixedClock,
  FixedExecutionScope,
  NoCurrentTenantError,
  executionContext,
  systemActor,
  type ExecutionScope,
  type TenantElevation,
} from '@ddd-ts-kit/kernel';
import { anExecutionContext, asTenant, scoped } from '@ddd-ts-kit/testing';
import { tenantIsolationContract, type CriteriaContractRow } from '@ddd-ts-kit/testing/contracts';
import { ConcurrencyError, PrismaReadModelTable, createPrismaUnitOfWork, ownTenantWhere, tenantWhere } from '../../src';
import type { Prisma } from '../generated/client/client';
import { Invoice } from '../support/billing-core/domain/invoice';
import { PrismaInvoiceRepository } from '../support/billing-core/infrastructure/persistence/prisma-invoice.repository';
import { createDatabase, type TestDatabase } from '../support/database';
import { CONTRACT_MODEL } from '../support/read-model/contract-model';
import { ada, scopeOf } from '../support/scopes';

const runner = { describe, it, expect, beforeEach, afterEach };
const clock = new FixedClock(new Date('2026-03-01T10:00:00.000Z'));

let database: TestDatabase;
let next = 0;

beforeAll(async () => {
  database = await createDatabase();
});

afterAll(async () => {
  await database.close();
});

const repository = (scope: ExecutionScope) =>
  new PrismaInvoiceRepository(createPrismaUnitOfWork(database.prisma), scope, clock);

/** Platform staff of a tenant of its own, reading over the given tenants. */
const staffOver = (tenants: TenantElevation['tenants']) =>
  anExecutionContext().ofTenant('initech').elevatedOver(tenants);

tenantIsolationContract<Invoice>(runner, {
  name: 'Prisma, shared tables',
  createAggregate: () => Invoice.draft(`inv-${(next += 1)}`, 100),
  recreate: (invoice) => Invoice.draft(invoice.id, 100),
  mutate: (invoice) => invoice.addCharge(50),
  idOf: (invoice) => invoice.id,
  stateOf: (invoice) => invoice.state,
  elevatedReads: true,
  createRepository: async (scope) => {
    await database.truncate();

    return repository(scope);
  },
});

describe('tenantWhere and ownTenantWhere', () => {
  const job = new FixedExecutionScope(
    executionContext({ correlationId: 'job', actor: systemActor('job'), origin: 'test' }),
  );

  it('name the tenant of the work, the tenants of an elevation, or nothing over every tenant', () => {
    expect(tenantWhere(scopeOf(ada))).toEqual({ tenantId: 'acme' });

    expect(tenantWhere(new FixedExecutionScope(staffOver(['globex', 'acme']).build()))).toEqual({
      tenantId: { in: ['globex', 'acme'] },
    });

    expect(tenantWhere(new FixedExecutionScope(staffOver('all').build()))).toEqual({});
    expect(ownTenantWhere(new FixedExecutionScope(staffOver('all').build()))).toEqual({ tenantId: 'initech' });
  });

  it('refuse work that names no tenant, before any statement', () => {
    expect(() => tenantWhere(job)).toThrow(NoCurrentTenantError);
    expect(() => ownTenantWhere(job)).toThrow(NoCurrentTenantError);
  });

  it('widen the reads of an elevation to the tenants it names, and never its writes', async () => {
    await database.truncate();
    const scope = new AsyncLocalStorageExecutionScope();
    const acme = Invoice.draft('inv-acme', 1);

    await asTenant(scope, 'acme', () => repository(scope).save(acme));
    await asTenant(scope, 'globex', () => repository(scope).save(Invoice.draft('inv-globex', 2)));

    const read = (tenants: TenantElevation['tenants']) =>
      scoped(scope, staffOver(tenants), () =>
        database.prisma.invoice.findMany({ where: tenantWhere(scope), orderBy: { id: 'asc' } }),
      );

    expect((await read('all')).map((row) => row.id)).toEqual(['inv-acme', 'inv-globex']);
    expect((await read(['globex'])).map((row) => row.id)).toEqual(['inv-globex']);

    const elevated = await scoped(scope, staffOver('all'), () => repository(scope).findById('inv-acme'));

    elevated?.addCharge(1);

    await expect(scoped(scope, staffOver('all'), () => repository(scope).save(elevated ?? acme))).rejects.toThrow(
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

  const table = () =>
    new PrismaReadModelTable<CriteriaContractRow, Prisma.TransactionClient>(createPrismaUnitOfWork(database.prisma), {
      ...CONTRACT_MODEL,
      tenant: { scope },
    });

  const idsSeenBy = (tenants: TenantElevation['tenants']) =>
    scoped(scope, staffOver(tenants), async () => (await table().search(plan)).rows.map((found) => found.id).sort());

  beforeEach(async () => {
    await table().abandonRebuild();
    await database.truncate();
  });

  it('writes each row in the tenant of the work, and keeps it from the others', async () => {
    await asTenant(scope, 'acme', () => table().insert({ key: 'a1', row, stamp }));

    expect((await asTenant(scope, 'acme', () => table().find('a1')))?.row?.tenantId).toBe('acme');
    expect(await asTenant(scope, 'globex', () => table().find('a1'))).toBeUndefined();
    expect(await asTenant(scope, 'globex', () => table().replace({ key: 'a1', row, stamp }, stamp))).toBe(false);
    expect(await asTenant(scope, 'globex', () => table().search(plan))).toEqual({ rows: [], total: 0 });
    expect((await asTenant(scope, 'acme', () => table().search(plan))).total).toBe(1);
    await expect(scoped(scope, anExecutionContext(), () => table().find('a1'))).rejects.toThrow(NoCurrentTenantError);
  });

  it('widens the reads of an elevation to the tenants it names, and never its writes', async () => {
    await asTenant(scope, 'acme', () => table().insert({ key: 'a1', row, stamp }));
    await asTenant(scope, 'globex', () => table().insert({ key: 'g1', row: { ...row, id: 'g1' }, stamp }));

    expect(await idsSeenBy('all')).toEqual(['a1', 'g1']);
    expect(await idsSeenBy(['globex'])).toEqual(['g1']);
    expect(await idsSeenBy([])).toEqual([]);
    expect((await scoped(scope, staffOver('all'), () => table().find('a1')))?.row?.tenantId).toBe('acme');
    expect(await scoped(scope, staffOver('all'), () => table().replace({ key: 'a1', row, stamp }, stamp))).toBe(false);
  });

  it('confines the copy of a rebuild, which has no model, the same way', async () => {
    const changed = { key: 'a1', row: { ...row, seats: 2 }, stamp };

    await table().beginRebuild();
    await asTenant(scope, 'acme', () => table().shadow().insert({ key: 'a1', row, stamp }));

    expect((await asTenant(scope, 'acme', () => table().shadow().find('a1')))?.row?.tenantId).toBe('acme');
    expect(await asTenant(scope, 'globex', () => table().shadow().find('a1'))).toBeUndefined();
    expect(await asTenant(scope, 'globex', () => table().shadow().replace(changed, stamp))).toBe(false);
    expect(await asTenant(scope, 'acme', () => table().shadow().replace(changed, stamp))).toBe(true);
    expect((await scoped(scope, staffOver('all'), () => table().shadow().find('a1')))?.row?.seats).toBe(2);
    expect(await scoped(scope, staffOver(['acme', 'globex']), () => table().shadow().find('a1'))).toBeDefined();
    expect(await scoped(scope, staffOver([]), () => table().shadow().find('a1'))).toBeUndefined();
    await table().abandonRebuild();
  });
});
