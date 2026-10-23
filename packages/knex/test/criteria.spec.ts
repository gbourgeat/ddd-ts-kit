import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Criteria, cursorPage, pageOfPlan, planCriteria, scoped } from '@ddd-ts-kit/kernel';
import {
  criteriaContract,
  criteriaContractDefinition,
  criteriaContractRows,
  type CriteriaContractRow,
} from '@ddd-ts-kit/testing/contracts';
import { KnexReadModelStore, createKnexUnitOfWork, criteriaToKnex } from '../src';
import { createDatabase, type TestDatabase } from './support/database';
import { CONTRACT_TABLE, READ_SIDE, createContractTable } from './support/read-model/criteria-contract-table';

const runner = { describe, it, expect, beforeEach, afterEach };
const TABLE = `${READ_SIDE}.${CONTRACT_TABLE.table}`;
const STAMP = { last_event_id: 'evt-1', last_event_at: new Date('2026-10-10T12:00:00Z') };

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase(createContractTable, [TABLE]);
});

afterAll(async () => {
  await database.close();
});

const storeOf = () =>
  new KnexReadModelStore<CriteriaContractRow>(createKnexUnitOfWork(database.knex), {
    ...CONTRACT_TABLE,
    definition: criteriaContractDefinition,
  });

async function load(rows: readonly CriteriaContractRow[]): Promise<void> {
  await database.truncate();

  await database
    .knex(CONTRACT_TABLE.table)
    .withSchema(READ_SIDE)
    .insert(
      rows.map((row) => ({
        ...STAMP,
        id: row.id,
        status: row.status,
        title: row.title,
        seats: row.seats,
        price: row.price,
        starts_at: row.startsAt,
        cancelled_at: row.cancelledAt,
        room: row.room,
        remote: row.remote,
        tenant_id: row.tenantId,
      })),
    );

  database.queries.length = 0;
}

criteriaContract(runner, {
  name: 'criteriaToKnex',
  createReadModel: async (rows) => {
    await load(rows);

    return { search: (criteria) => storeOf().search(criteria) };
  },
});

describe('criteriaToKnex', () => {
  const columns = CONTRACT_TABLE.columns;
  const all = Criteria.of<CriteriaContractRow>();

  const sqlOf = (criteria: Criteria<CriteriaContractRow>) =>
    criteriaToKnex(
      database.knex('criteria_contract'),
      planCriteria(criteriaContractDefinition, criteria),
      columns,
    ).toSQL();

  beforeEach(async () => {
    await load(criteriaContractRows());
  });

  it('binds every value and never writes one into the statement', () => {
    const hostile = "x'; drop table criteria_contract; --";

    const { sql, bindings } = sqlOf(
      all
        .where('title', 'contains', hostile)
        .where('title', 'in', ['booked', hostile])
        .not((none) => none.where('room', 'eq', hostile)),
    );

    expect(sql).not.toContain('drop table');

    expect(sql).toBe(
      'select * from "criteria_contract" where (("title" like ? escape ?) and ("title" in (?, ?)) and (("room" is null) or (not ("room" = ?)))) order by "starts_at" asc, "id" asc limit ?',
    );

    expect(bindings).toEqual(["%x'; drop table criteria\\_contract; --%", '\\', 'booked', hostile, hostile, 20]);
  });

  it('orders a field that may be null as the plan means it, and seeks past a cursor by the same order', async () => {
    const first = await storeOf().search(
      scoped(all.orderBy('room', 'desc').page(cursorPage({ limit: 3 })), { kind: 'all' }),
    );

    const { sql } = sqlOf(
      all
        .orderBy('room', 'desc')
        .page(cursorPage({ limit: 3, ...(first.nextCursor === undefined ? {} : { cursor: first.nextCursor }) })),
    );

    expect(first.items.map(({ id }) => id)).toEqual(['a5', 'a3', 'a7']);

    expect(sql).toBe(
      'select * from "criteria_contract" where (("room" < ?) or (("room" = ?) and ("id" < ?))) order by "room" desc nulls first, "id" desc limit ?',
    );
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

    const records = await criteriaToKnex(
      database.knex('criteria_contract').withSchema(READ_SIDE).select('id', 'seats', 'starts_at as startsAt'),
      plan,
      columns,
    );

    const page = pageOfPlan(plan, records);

    expect(page.items).toEqual([{ id: 'a2', seats: 4, startsAt: new Date('2026-10-01T09:00:00.000Z') }]);
    expect(page.nextCursor).toBeTypeOf('string');
  });
});
