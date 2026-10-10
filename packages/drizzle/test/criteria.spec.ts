import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { Criteria, cursorPage, pageOfPlan, planCriteria, scoped } from '@ddd-ts-kit/kernel';
import {
  criteriaContract,
  criteriaContractDefinition,
  criteriaContractRows,
  type CriteriaContractRow,
} from '@ddd-ts-kit/testing/contracts';
import { DrizzleReadModelStore, createDrizzleUnitOfWork, criteriaToDrizzle } from '../src/postgres.js';
import { createContractDatabase, type ContractDatabase } from './support/read-model/contract-database.js';
import { CONTRACT_TABLE, contractRows } from './support/read-model/criteria-contract-table.js';

const runner = { describe, it, expect, beforeEach, afterEach };
const STAMP = { lastEventId: 'evt-1', lastEventAt: new Date('2026-10-10T12:00:00Z') };

let database: ContractDatabase;

beforeAll(async () => {
  database = await createContractDatabase([contractRows]);
});

afterAll(async () => {
  await database.close();
});

const storeOf = () =>
  new DrizzleReadModelStore(createDrizzleUnitOfWork(database.db), {
    ...CONTRACT_TABLE,
    definition: criteriaContractDefinition,
  });

async function load(rows: readonly CriteriaContractRow[]): Promise<void> {
  await database.db.execute(sql`truncate table ${contractRows}`);
  await database.db.insert(contractRows).values(rows.map((row) => ({ ...row, ...STAMP })));
  database.logger.queries.length = 0;
}

criteriaContract(runner, {
  name: 'criteriaToDrizzle',
  createReadModel: async (rows) => {
    await load(rows);

    return { search: (criteria) => storeOf().search(criteria) };
  },
});

describe('criteriaToDrizzle', () => {
  const all = Criteria.of<CriteriaContractRow>();
  const dialect = new PgDialect();

  const partsOf = (criteria: Criteria<CriteriaContractRow>) =>
    criteriaToDrizzle(planCriteria(criteriaContractDefinition, criteria), CONTRACT_TABLE.columns);

  beforeEach(async () => {
    await load(criteriaContractRows());
  });

  it('binds every value and never writes one into the statement', () => {
    const hostile = "x'; drop table criteria_contract; --";

    const { where } = partsOf(
      all
        .where('title', 'contains', hostile)
        .where('title', 'in', ['booked', hostile])
        .not((none) => none.where('room', 'eq', hostile)),
    );

    const query = dialect.sqlToQuery(where ?? sql``);

    expect(query.sql).not.toContain('drop table');

    expect(query.sql).toBe(
      '("read_side"."criteria_contract"."title" like $1 escape $2 and "read_side"."criteria_contract"."title" in ($3, $4) and ("read_side"."criteria_contract"."room" is null or not "read_side"."criteria_contract"."room" = $5))',
    );

    expect(query.params).toEqual(["%x'; drop table criteria\\_contract; --%", '\\', 'booked', hostile, hostile]);
  });

  it('orders a field that may be null as the plan means it, and seeks past a cursor by the same order', async () => {
    const first = await storeOf().search(
      scoped(all.orderBy('room', 'desc').page(cursorPage({ limit: 3 })), { kind: 'all' }),
    );

    const { where, orderBy } = partsOf(
      all
        .orderBy('room', 'desc')
        .page(cursorPage({ limit: 3, ...(first.nextCursor === undefined ? {} : { cursor: first.nextCursor }) })),
    );

    const column = '"read_side"."criteria_contract"';

    expect(first.items.map(({ id }) => id)).toEqual(['a5', 'a3', 'a7']);

    expect(dialect.sqlToQuery(where ?? sql``).sql).toBe(
      `(${column}."room" < $1 or (${column}."room" = $2 and ${column}."id" < $3))`,
    );

    expect(orderBy.map((order) => dialect.sqlToQuery(order).sql)).toEqual([
      `${column}."room" desc nulls first`,
      `${column}."id" desc`,
    ]);
  });

  it('reads a page with one statement for a cursor page, two for an offset page, and none for an empty scope', async () => {
    await storeOf().search(scoped(all.page(cursorPage({ limit: 2 })), { kind: 'all' }));
    expect(database.logger.queries).toHaveLength(1);

    await storeOf().search(scoped(all, { kind: 'all' }));
    expect(database.logger.queries).toHaveLength(3);

    await storeOf().search(scoped(all, { kind: 'none' }));
    expect(database.logger.queries).toHaveLength(3);
  });

  it('serves a read port that is not a store: the plan, the query, the page', async () => {
    const plan = planCriteria(criteriaContractDefinition, all.where('seats', 'gte', 4).page(cursorPage({ limit: 1 })));
    const { where, orderBy, limit } = criteriaToDrizzle(plan, CONTRACT_TABLE.columns);
    const selected = { id: contractRows.id, seats: contractRows.seats, startsAt: contractRows.startsAt };

    const page = pageOfPlan(
      plan,
      await database.db
        .select(selected)
        .from(contractRows)
        .where(where)
        .orderBy(...orderBy)
        .limit(limit),
    );

    expect(page.items).toEqual([{ id: 'a2', seats: 4, startsAt: new Date('2026-10-01T09:00:00.000Z') }]);
    expect(page.nextCursor).toBeTypeOf('string');
  });
});
