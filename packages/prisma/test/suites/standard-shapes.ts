import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ConcurrencyError,
  FixedClock,
  InvalidPageRequestError,
  NoCurrentTenantError,
  cursorPage,
  offsetPage,
  type ExecutionScope,
} from '@ddd-ts-kit/kernel';
import { createPrismaUnitOfWork } from '../../src/index.js';
import { createDatabase, type TestDatabase } from '../support/database.js';
import { Invoice } from '../support/billing-core/domain/invoice.js';
import { PrismaInvoiceQueries } from '../support/billing-core/infrastructure/persistence/prisma-invoice.queries.js';
import { PrismaInvoiceRepository } from '../support/billing-core/infrastructure/persistence/prisma-invoice.repository.js';
import { ada, bob, eve, nobody, scopeOf } from '../support/scopes.js';

const MORNING = new Date('2026-03-01T10:00:00.000Z');

let database: TestDatabase;
let clock: FixedClock;

beforeAll(async () => {
  database = await createDatabase();
});

afterAll(async () => {
  await database.close();
});

beforeEach(async () => {
  await database.truncate();
  clock = new FixedClock(MORNING);
});

const repositoryOf = (scope: ExecutionScope) =>
  new PrismaInvoiceRepository(createPrismaUnitOfWork(database.prisma), scope, clock);

const queriesOf = (scope: ExecutionScope) => new PrismaInvoiceQueries(createPrismaUnitOfWork(database.prisma), scope);

/** The stored row, read without tenant scoping: what an operator would see in the table. */
async function stored(id: string) {
  return (await database.prisma.invoice.findUnique({ where: { id } })) ?? undefined;
}

async function draft(scope: ExecutionScope, id: string, amount: number): Promise<void> {
  await repositoryOf(scope).save(Invoice.draft(id, amount));
}

describe('audit columns', () => {
  it('are named the same in every project', async () => {
    const columns = await database.prisma.$queryRawUnsafe<{ column_name: string }[]>(
      "select column_name from information_schema.columns where table_schema = 'billing_core' and table_name = 'invoices'",
    );

    expect(columns.map((column) => column.column_name)).toEqual(
      expect.arrayContaining(['created_at', 'created_by', 'updated_at', 'updated_by', 'tenant_id']),
    );
  });

  it('stamp a created row with the actor and the instant of the work in progress', async () => {
    await draft(scopeOf(ada), 'inv-1', 100);

    expect(await stored('inv-1')).toMatchObject({
      createdAt: MORNING,
      createdBy: 'ada',
      updatedAt: MORNING,
      updatedBy: 'ada',
    });
  });

  it('stamp an update without touching who created the row, nor when', async () => {
    await draft(scopeOf(ada), 'inv-1', 100);
    clock.advance(3_600_000);
    const invoice = await repositoryOf(scopeOf(bob)).findById('inv-1');

    invoice?.addCharge(50);

    if (invoice !== undefined) {
      await repositoryOf(scopeOf(bob)).save(invoice);
    }

    expect(await stored('inv-1')).toMatchObject({
      amount: 150,
      createdAt: MORNING,
      createdBy: 'ada',
      updatedAt: new Date('2026-03-01T11:00:00.000Z'),
      updatedBy: 'bob',
    });
  });
});

describe('tenant scoping', () => {
  it('writes the tenant of the work in progress on a created row', async () => {
    await draft(scopeOf(eve), 'inv-1', 100);

    expect((await stored('inv-1'))?.tenantId).toBe('globex');
  });

  it('hides the rows of another tenant from every read', async () => {
    await draft(scopeOf(ada), 'inv-1', 100);

    expect(await repositoryOf(scopeOf(eve)).findById('inv-1')).toBeUndefined();
    expect(await queriesOf(scopeOf(eve)).list(offsetPage())).toEqual({ items: [], total: 0 });
    expect((await queriesOf(scopeOf(eve)).list(cursorPage())).items).toEqual([]);
    expect((await repositoryOf(scopeOf(bob)).findById('inv-1'))?.state.amount).toBe(100);
  });

  it('refuses to update a row of another tenant, even with its id and version in hand', async () => {
    await draft(scopeOf(ada), 'inv-1', 100);
    const invoice = await repositoryOf(scopeOf(ada)).findById('inv-1');

    invoice?.addCharge(900);

    const stolen = invoice === undefined ? undefined : repositoryOf(scopeOf(eve)).save(invoice);

    await expect(stolen).rejects.toBeInstanceOf(ConcurrencyError);
    expect(await stored('inv-1')).toMatchObject({ amount: 100, tenantId: 'acme', updatedBy: 'ada' });
  });

  it('refuses to reach tenant-scoped storage from work that names no tenant', async () => {
    await expect(draft(scopeOf(nobody), 'inv-1', 100)).rejects.toBeInstanceOf(NoCurrentTenantError);
    await expect(repositoryOf(scopeOf(nobody)).findById('inv-1')).rejects.toBeInstanceOf(NoCurrentTenantError);
    await expect(queriesOf(scopeOf(nobody)).list(offsetPage())).rejects.toBeInstanceOf(NoCurrentTenantError);
  });
});

describe('a list query', () => {
  /** Seven invoices, five of them of the same amount: only a tie-breaker gives them an order. */
  const AMOUNTS: Readonly<Record<string, number>> = {
    'inv-a': 50,
    'inv-b': 100,
    'inv-c': 100,
    'inv-d': 100,
    'inv-e': 100,
    'inv-f': 100,
    'inv-g': 300,
  };

  const ASCENDING = ['inv-a', 'inv-b', 'inv-c', 'inv-d', 'inv-e', 'inv-f', 'inv-g'];

  beforeEach(async () => {
    for (const [id, amount] of Object.entries(AMOUNTS).reverse()) {
      await draft(scopeOf(ada), id, amount);
    }

    await draft(scopeOf(eve), 'inv-of-globex', 100);
  });

  const idsOf = (page: { items: readonly { id: string }[] }) => page.items.map((item) => item.id);

  it('answers an offset page with the total, in an order the tie-breaker makes total', async () => {
    const queries = queriesOf(scopeOf(ada));

    const first = await queries.list(offsetPage({ limit: 3 }));
    const second = await queries.list(offsetPage({ limit: 3, offset: 3 }));
    const third = await queries.list(offsetPage({ limit: 3, offset: 6 }));

    expect(first).toEqual({
      items: [
        { id: 'inv-a', amount: 50, status: 'draft' },
        { id: 'inv-b', amount: 100, status: 'draft' },
        { id: 'inv-c', amount: 100, status: 'draft' },
      ],
      total: 7,
    });

    expect([...idsOf(first), ...idsOf(second), ...idsOf(third)]).toEqual(ASCENDING);
  });

  it('sorts in the direction it is asked, tie-breaker included', async () => {
    const page = await queriesOf(scopeOf(ada)).list(
      offsetPage({ limit: 7, sort: [{ field: 'amount', direction: 'desc' }] }),
    );

    expect(idsOf(page)).toEqual([...ASCENDING].reverse());
  });

  it.each(['asc', 'desc'] as const)(
    'walks every row exactly once by cursor, %s, across rows of equal amount',
    async (direction) => {
      const queries = queriesOf(scopeOf(ada));
      const seen: string[] = [];
      let cursor: string | undefined;

      do {
        const page = await queries.list(
          cursorPage({ limit: 2, sort: [{ field: 'amount', direction }], ...(cursor === undefined ? {} : { cursor }) }),
        );

        seen.push(...idsOf(page));
        cursor = page.nextCursor;
      } while (cursor !== undefined);

      expect(seen).toEqual(direction === 'asc' ? ASCENDING : [...ASCENDING].reverse());
    },
  );

  it('names no next cursor on the last page, even when it is full', async () => {
    const page = await queriesOf(scopeOf(ada)).list(cursorPage({ limit: 7 }));

    expect(idsOf(page)).toEqual(ASCENDING);
    expect(page).not.toHaveProperty('nextCursor');
    expect(page).not.toHaveProperty('total');
  });

  it('keeps its place by cursor when a row is inserted before it, where an offset would repeat one', async () => {
    const queries = queriesOf(scopeOf(ada));
    const first = await queries.list(cursorPage({ limit: 3 }));

    await draft(scopeOf(ada), 'inv-0', 10);

    const second = await queries.list(
      cursorPage({ limit: 3, ...(first.nextCursor === undefined ? {} : { cursor: first.nextCursor }) }),
    );

    expect(idsOf(second)).toEqual(['inv-d', 'inv-e', 'inv-f']);
    expect(idsOf(await queries.list(offsetPage({ limit: 3, offset: 3 })))).toEqual(['inv-c', 'inv-d', 'inv-e']);
  });

  it('refuses a cursor it did not write', async () => {
    const queries = queriesOf(scopeOf(ada));
    const forged = Buffer.from(JSON.stringify({ amount: '0 or 1=1', id: 7 })).toString('base64url');

    await expect(queries.list(cursorPage({ cursor: 'not-a-cursor' }))).rejects.toBeInstanceOf(InvalidPageRequestError);
    await expect(queries.list(cursorPage({ cursor: forged }))).rejects.toBeInstanceOf(InvalidPageRequestError);
  });
});
