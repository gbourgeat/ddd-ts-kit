import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readModelStoreContract, type CriteriaContractRow } from '@ddd-ts-kit/testing/contracts';
import type { Knex } from 'knex';
import { AsyncLocalStorageExecutionScope, ReadModelTableNotReadyError } from '@ddd-ts-kit/kernel';
import { asTenant } from '@ddd-ts-kit/testing';
import { KnexReadModelTable, createKnexUnitOfWork, readModelColumns, type KnexReadModelOptions } from '../src';
import { createDatabase, type TestDatabase } from './support/database';
import {
  CONTRACT_TABLE,
  CONTRACT_TABLE_IN_DEFAULT_SCHEMA,
  READ_SIDE,
  createContractTable,
  createContractTableInDefaultSchema,
} from './support/read-model/criteria-contract-table';

const runner = { describe, it, expect, beforeEach, afterEach };
const TABLE = `${READ_SIDE}.${CONTRACT_TABLE.table}`;

interface StrictRow {
  readonly id: string;
  readonly title: string;
  readonly note: string | null;
}

/** A read model as it was declared before a deleted row kept no data: `title` refuses NULL. */
const STRICT: KnexReadModelOptions<StrictRow> = {
  table: 'strict_rows',
  columns: { id: 'id', title: 'title', note: 'note' },
};

async function createStrictTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(STRICT.table, (table) => {
    table.text('id').primary();
    table.text('title').notNullable();
    table.text('note').nullable();
    table.text('tenant_id').notNullable();
    readModelColumns(table);
  });
}

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase(
    async (knex) => {
      await createContractTable(knex);
      await createContractTableInDefaultSchema(knex);
      await createStrictTable(knex);
    },
    [TABLE, CONTRACT_TABLE_IN_DEFAULT_SCHEMA.table, STRICT.table],
  );
});

afterAll(async () => {
  await database.close();
});

const tableOf = () => {
  const unitOfWork = createKnexUnitOfWork(database.knex);

  return { table: new KnexReadModelTable<CriteriaContractRow>(unitOfWork, CONTRACT_TABLE), unitOfWork };
};

const FIELDS =
  'id, status, title, seats, price, starts_at as "startsAt", cancelled_at as "cancelledAt", room, remote, tenant_id as "tenantId"';

/** What a table holds under a key, by field of the row, read beside the store. */
const storedIn = (table: string) => async (key: string) => {
  const { rows } = await database.knex.raw<{ rows: Record<string, unknown>[] }>(
    `select ${FIELDS} from ${table} where id = ?`,
    [key],
  );

  return rows[0];
};

readModelStoreContract(runner, {
  name: 'KnexReadModelTable',
  createTable: async () => {
    await tableOf().table.abandonRebuild();
    await database.truncate();

    return tableOf();
  },
  stored: storedIn(TABLE),
  uniqueTitle: true,
});

// A read model in the default schema of the connection, its rebuild included.
readModelStoreContract(runner, {
  name: 'KnexReadModelTable in the default schema',
  createTable: async () => {
    const unitOfWork = createKnexUnitOfWork(database.knex);
    const table = new KnexReadModelTable<CriteriaContractRow>(unitOfWork, CONTRACT_TABLE_IN_DEFAULT_SCHEMA);

    await table.abandonRebuild();
    await database.truncate();

    return { table, unitOfWork };
  },
  stored: storedIn(CONTRACT_TABLE_IN_DEFAULT_SCHEMA.table),
  uniqueTitle: true,
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

describe('KnexReadModelTable of a table whose columns refuse NULL', () => {
  const stamp = { eventId: 'evt-1', occurredAt: new Date('2026-10-10T12:00:00.000Z') };
  const later = { eventId: 'evt-2', occurredAt: new Date('2026-10-10T12:01:00.000Z') };
  const scope = new AsyncLocalStorageExecutionScope();

  const strict = () => {
    const unitOfWork = createKnexUnitOfWork(database.knex);

    return { table: new KnexReadModelTable<StrictRow>(unitOfWork, { ...STRICT, tenant: scope }), unitOfWork };
  };

  beforeEach(async () => {
    await database.truncate();
  });

  it('refuses the trace of a deleted row by name, before any statement the database would refuse', async () => {
    const { table, unitOfWork } = strict();

    const written = asTenant(scope, 'acme', () =>
      unitOfWork.run(async () => {
        const refusal = await table.insert({ key: 's1', row: undefined, stamp }).catch((error: unknown) => error);

        // The transaction is still usable: nothing was sent that PostgreSQL refused.
        await table.insert({ key: 's2', row: { id: 's2', title: 'kept', note: null }, stamp });

        return refusal;
      }),
    );

    await expect(written).resolves.toBeInstanceOf(ReadModelTableNotReadyError);
    await expect(written).resolves.toMatchObject({ table: 'strict_rows', columns: ['title'] });
    expect(await asTenant(scope, 'acme', () => table.find('s2'))).toBeDefined();
  });

  it('refuses the same way to empty a row it holds, each time, and on the copy of a rebuild', async () => {
    const { table } = strict();

    await asTenant(scope, 'acme', async () => {
      await table.insert({ key: 's1', row: { id: 's1', title: 'held', note: 'n' }, stamp });

      await expect(table.replace({ key: 's1', row: undefined, stamp: later }, stamp)).rejects.toThrow(
        'check (deleted or ("title" is not null))',
      );

      await expect(table.shadow().insert({ key: 's3', row: undefined, stamp })).rejects.toThrow(
        ReadModelTableNotReadyError,
      );

      expect((await table.find('s1'))?.row).toEqual({ id: 's1', title: 'held', note: 'n' });
    });
  });
});
