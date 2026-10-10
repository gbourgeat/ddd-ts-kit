import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readModelStoreContract, type CriteriaContractRow } from '@ddd-ts-kit/testing/contracts';
import { KnexReadModelTable, createKnexUnitOfWork } from '../src/index.js';
import { createDatabase, type TestDatabase } from './support/database.js';
import { CONTRACT_TABLE, READ_SIDE, createContractTable } from './support/read-model/criteria-contract-table.js';

const runner = { describe, it, expect, beforeEach, afterEach };
const TABLE = `${READ_SIDE}.${CONTRACT_TABLE.table}`;

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase(createContractTable, [TABLE]);
});

afterAll(async () => {
  await database.close();
});

const tableOf = () => {
  const unitOfWork = createKnexUnitOfWork(database.knex);

  return { table: new KnexReadModelTable<CriteriaContractRow>(unitOfWork, CONTRACT_TABLE), unitOfWork };
};

readModelStoreContract(runner, {
  name: 'KnexReadModelTable',
  createTable: async () => {
    await tableOf().table.abandonRebuild();
    await database.truncate();

    return tableOf();
  },
});

describe('KnexReadModelTable', () => {
  const stamp = { eventId: 'evt-1', occurredAt: new Date('2026-10-10T12:00:00.000Z') };

  beforeEach(async () => {
    await tableOf().table.abandonRebuild();
    await database.truncate();
  });

  it('writes on the transaction of the unit of work: a failure takes the row back with it', async () => {
    const { table, unitOfWork } = tableOf();

    const row = {
      id: 'a1',
      status: 'booked',
      title: 't',
      seats: 1,
      price: '1',
      startsAt: stamp.occurredAt,
      cancelledAt: null,
      room: null,
      remote: false,
      tenantId: 'acme',
    } as const;

    const failed = unitOfWork.run(async () => {
      await table.insert({ key: 'a1', row, stamp });

      throw new Error('the handler fails after its write');
    });

    await expect(failed).rejects.toThrow('the handler fails');
    expect(await table.find('a1')).toBeUndefined();
  });

  it('replaces a row only while it holds the stamp that was read', async () => {
    const { table } = tableOf();

    const row = {
      id: 'a1',
      status: 'booked',
      title: 't',
      seats: 1,
      price: '1',
      startsAt: stamp.occurredAt,
      cancelledAt: null,
      room: null,
      remote: false,
      tenantId: 'acme',
    } as const;

    const later = { eventId: 'evt-2', occurredAt: new Date('2026-10-10T12:01:00.000Z') };

    await table.insert({ key: 'a1', row, stamp });

    expect(await table.replace({ key: 'a1', row: { ...row, seats: 2 }, stamp: later }, stamp)).toBe(true);
    expect(await table.replace({ key: 'a1', row: { ...row, seats: 3 }, stamp: later }, stamp)).toBe(false);
    expect((await table.find('a1'))?.row?.seats).toBe(2);
  });

  it('swaps the rebuilt copy in by renaming, in one transaction, and leaves no table behind', async () => {
    const { table, unitOfWork } = tableOf();

    await table.beginRebuild();
    database.queries.length = 0;

    await unitOfWork.run(async () => {
      await table.holdWriters();
      await table.promote();
    });

    expect(database.queries).toEqual([
      'BEGIN;',
      'lock table "read_side"."criteria_contract__touched", "read_side"."criteria_contract" in access exclusive mode',
      'alter table "read_side"."criteria_contract" rename to "criteria_contract__retired"',
      'alter table "read_side"."criteria_contract__rebuild" rename to "criteria_contract"',
      'drop table "read_side"."criteria_contract__retired"',
      'drop table "read_side"."criteria_contract__touched"',
      'COMMIT;',
    ]);

    const { rows } = await database.knex.raw<{ rows: { tablename: string }[] }>(
      "select tablename from pg_tables where schemaname = 'read_side' order by 1",
    );

    expect(rows.map(({ tablename }) => tablename)).toEqual(['criteria_contract']);
  });
});
