import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Criteria, cursorPage, pageOfPlan, planCriteria, scoped } from '@ddd-ts-kit/kernel';
import {
  criteriaContract,
  criteriaContractDefinition,
  criteriaContractRows,
  type CriteriaContractRow,
} from '@ddd-ts-kit/testing/contracts';
import { TypeOrmReadModelStore, createTypeOrmUnitOfWork, criteriaToTypeOrm } from '../src';
import { createDatabase, type TestDatabase } from './support/database';
import { contractRows } from './support/read-model/criteria-contract-rows';

const runner = { describe, it, expect, beforeEach, afterEach };

const STAMP = {
  lastEventId: 'evt-1',
  lastEventAt: new Date('2026-10-10T12:00:00Z'),
  lastEventVersion: null,
  deleted: false,
};

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase([contractRows]);
});

afterAll(async () => {
  await database.close();
});

const storeOf = () =>
  new TypeOrmReadModelStore(createTypeOrmUnitOfWork(database.dataSource), {
    entity: contractRows,
    definition: criteriaContractDefinition,
  });

async function load(rows: readonly CriteriaContractRow[]): Promise<void> {
  await database.truncate();

  await database.dataSource.manager.insert(
    contractRows,
    rows.map((row) => ({ ...row, ...STAMP })),
  );

  database.queries.length = 0;
}

criteriaContract(runner, {
  name: 'criteriaToTypeOrm',
  createReadModel: async (rows) => {
    await load(rows);

    return { search: (criteria) => storeOf().search(criteria) };
  },
});

describe('criteriaToTypeOrm', () => {
  const all = Criteria.of<CriteriaContractRow>();

  const queryOf = (criteria: Criteria<CriteriaContractRow>) =>
    criteriaToTypeOrm(
      database.dataSource.manager.createQueryBuilder(contractRows, 'row').select('row.id'),
      planCriteria(criteriaContractDefinition, criteria),
      { alias: 'row' },
    );

  beforeEach(async () => {
    await load(criteriaContractRows());
  });

  it('binds every value and never writes one into the statement', () => {
    const hostile = "x'; drop table criteria_contract; --";

    const [statement, parameters] = queryOf(
      all
        .where('title', 'contains', hostile)
        .where('title', 'in', ['booked', hostile])
        .not((none) => none.where('room', 'eq', hostile)),
    ).getQueryAndParameters();

    expect(statement).not.toContain('drop table');

    expect(statement).toBe(
      'SELECT "row"."id" AS "row_id" FROM "read_side"."criteria_contract" "row" WHERE (("row"."title" LIKE $1 ESCAPE $2) AND ("row"."title" IN ($3, $4)) AND (("row"."room" IS NULL) OR (NOT("row"."room" = $5)))) ORDER BY "row"."starts_at" ASC, "row_id" ASC LIMIT 20',
    );

    expect(parameters).toEqual(["%x'; drop table criteria\\_contract; --%", '\\', 'booked', hostile, hostile]);
  });

  it('orders a field that may be null as the plan means it, and seeks past a cursor by the same order', async () => {
    const first = await storeOf().search(
      scoped(all.orderBy('room', 'desc').page(cursorPage({ limit: 3 })), { kind: 'all' }),
    );

    const next = all
      .where('seats', 'gte', 1)
      .orderBy('room', 'desc')
      .page(cursorPage({ limit: 3, ...(first.nextCursor === undefined ? {} : { cursor: first.nextCursor }) }));

    const [statement, parameters] = queryOf(next).getQueryAndParameters();

    expect(first.items.map(({ id }) => id)).toEqual(['a5', 'a3', 'a7']);

    expect(statement).toBe(
      'SELECT "row"."id" AS "row_id" FROM "read_side"."criteria_contract" "row" WHERE ("row"."seats" >= $1) AND (("row"."room" < $2) OR (("row"."room" = $3) AND ("row"."id" < $4))) ORDER BY "row"."room" DESC NULLS FIRST, "row_id" DESC LIMIT 4',
    );

    expect(parameters).toEqual([1, 'É', 'É', 'a7']);
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

    const entities = await criteriaToTypeOrm(database.dataSource.manager.createQueryBuilder(contractRows, 'r'), plan, {
      alias: 'r',
    }).getMany();

    const page = pageOfPlan(
      plan,
      entities.map(({ id, seats, startsAt }) => ({ id, seats, startsAt })),
    );

    expect(page.items).toEqual([{ id: 'a2', seats: 4, startsAt: new Date('2026-10-01T09:00:00.000Z') }]);
    expect(page.nextCursor).toBeTypeOf('string');
  });
});
