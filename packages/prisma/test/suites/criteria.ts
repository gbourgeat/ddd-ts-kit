import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Criteria, cursorPage, pageOfPlan, planCriteria, scoped } from '@ddd-ts-kit/kernel';
import {
  criteriaContract,
  criteriaContractDefinition,
  criteriaContractRows,
  type CriteriaContractRow,
} from '@ddd-ts-kit/testing/contracts';
import { PrismaReadModelStore, createPrismaUnitOfWork, criteriaToPrisma } from '../../src/index.js';
import { createDatabase, type TestDatabase } from '../support/database.js';
import { CONTRACT_MODEL } from '../support/read-model/contract-model.js';

const runner = { describe, it, expect, beforeEach, afterEach };
const STAMP = { lastEventId: 'evt-1', lastEventAt: new Date('2026-10-10T12:00:00Z') };

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase();
});

afterAll(async () => {
  await database.close();
});

const storeOf = () =>
  new PrismaReadModelStore(createPrismaUnitOfWork(database.prisma), {
    ...CONTRACT_MODEL,
    definition: criteriaContractDefinition,
  });

async function load(rows: readonly CriteriaContractRow[]): Promise<void> {
  await database.truncate();
  await database.prisma.criteriaContractRow.createMany({ data: rows.map((row) => ({ ...row, ...STAMP })) });
  database.queries.length = 0;
}

criteriaContract(runner, {
  name: 'criteriaToPrisma',
  createReadModel: async (rows) => {
    await load(rows);

    return { search: (criteria) => storeOf().search(criteria) };
  },
});

describe('criteriaToPrisma', () => {
  const all = Criteria.of<CriteriaContractRow>();

  const argumentsOf = (criteria: Criteria<CriteriaContractRow>) =>
    criteriaToPrisma(planCriteria(criteriaContractDefinition, criteria));

  beforeEach(async () => {
    await load(criteriaContractRows());
  });

  it('hands every value to Prisma as data, and never writes one into a statement', async () => {
    const hostile = "x'; drop table criteria_contract; --";

    const asked = all
      .where('title', 'contains', hostile)
      .where('title', 'in', ['booked', hostile])
      .not((none) => none.where('room', 'eq', hostile));

    expect(argumentsOf(asked).where).toEqual({
      AND: [
        { title: { contains: "x'; drop table criteria\\_contract; --" } },
        { title: { in: ['booked', hostile] } },
        { OR: [{ room: null }, { NOT: { room: { equals: hostile } } }] },
      ],
    });

    await storeOf().search(scoped(asked, { kind: 'all' }));

    expect(database.queries.join('\n')).not.toContain('drop table');
    expect(await database.prisma.criteriaContractRow.count()).toBe(8);
  });

  it('orders a field that may be null as the plan means it, and seeks past a cursor by the same order', async () => {
    const first = await storeOf().search(
      scoped(all.orderBy('room', 'desc').page(cursorPage({ limit: 3 })), { kind: 'all' }),
    );

    const { where, orderBy, take } = argumentsOf(
      all
        .orderBy('room', 'desc')
        .page(cursorPage({ limit: 3, ...(first.nextCursor === undefined ? {} : { cursor: first.nextCursor }) })),
    );

    expect(first.items.map(({ id }) => id)).toEqual(['a5', 'a3', 'a7']);

    expect(where).toEqual({
      AND: [{}, { OR: [{ room: { lt: 'É' } }, { AND: [{ room: { equals: 'É' } }, { id: { lt: 'a7' } }] }] }],
    });

    expect(orderBy).toEqual([{ room: { sort: 'desc', nulls: 'first' } }, { id: 'desc' }]);
    expect(take).toBe(4);
  });

  it('reads a page with one statement for a cursor page, two for an offset page, and none for an empty scope', async () => {
    await storeOf().search(scoped(all.page(cursorPage({ limit: 2 })), { kind: 'all' }));
    expect(database.queries).toHaveLength(1);

    await storeOf().search(scoped(all, { kind: 'all' }));
    expect(database.queries).toHaveLength(3);

    await storeOf().search(scoped(all, { kind: 'none' }));
    expect(database.queries).toHaveLength(3);
  });

  it('serves a read port that is not a store: the plan, the query, the page', async () => {
    const plan = planCriteria(criteriaContractDefinition, all.where('seats', 'gte', 4).page(cursorPage({ limit: 1 })));
    const { where, orderBy, take } = criteriaToPrisma(plan);

    const found = await database.prisma.criteriaContractRow.findMany({
      where,
      orderBy,
      take,
      select: { id: true, seats: true, startsAt: true },
    });

    const page = pageOfPlan(plan, found);

    expect(page.items).toEqual([{ id: 'a2', seats: 4, startsAt: new Date('2026-10-01T09:00:00.000Z') }]);
    expect(page.nextCursor).toBeTypeOf('string');
  });
});
