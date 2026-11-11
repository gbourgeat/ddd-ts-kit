import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import type { PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { readModelStoreContract, type CriteriaContractRow } from '@ddd-ts-kit/testing/contracts';
import { pgTable, text } from 'drizzle-orm/pg-core';
import { AsyncLocalStorageExecutionScope, ReadModelTableNotReadyError } from '@ddd-ts-kit/kernel';
import { DrizzleReadModelTable, createDrizzleUnitOfWork, readModelColumns } from '../src/postgres';
import { rowsOf } from '../src/postgres/read-model/rows-of';
import { createContractDatabase, type ContractDatabase } from './support/read-model/contract-database';
import { CONTRACT_TABLE, contractRows } from './support/read-model/criteria-contract-table';
import { invoices as plain } from './support/billing-core/infrastructure/persistence/invoices';

const runner = { describe, it, expect, beforeEach, afterEach };

let database: ContractDatabase;

beforeAll(async () => {
  database = await createContractDatabase([contractRows]);
});

afterAll(async () => {
  await database.close();
});

const tableOf = () => {
  const unitOfWork = createDrizzleUnitOfWork(database.db);

  return {
    table: new DrizzleReadModelTable<CriteriaContractRow, PgQueryResultHKT>(unitOfWork, CONTRACT_TABLE),
    unitOfWork,
  };
};

async function emptied() {
  await tableOf().table.abandonRebuild();
  await database.db.execute(sql`truncate table ${contractRows}`);
  database.logger.queries.length = 0;

  return tableOf();
}

/** What the table holds under a key, by field of the row, read beside the store. */
async function stored(key: string) {
  const held = await database.db.execute(
    sql`select id, status, title, seats, price, starts_at as "startsAt", cancelled_at as "cancelledAt", room, remote, tenant_id as "tenantId" from ${contractRows} where id = ${key}`,
  );

  return rowsOf(held)[0];
}

readModelStoreContract(runner, { name: 'DrizzleReadModelTable', createTable: emptied, stored, uniqueTitle: true });

describe('DrizzleReadModelTable', () => {
  const stamp = { eventId: 'evt-1', occurredAt: new Date('2026-10-10T12:00:00.000Z') };

  const row = {
    id: 'a1',
    status: 'booked',
    title: "t'; drop table x; --",
    seats: 1,
    price: '1',
    startsAt: stamp.occurredAt,
    cancelledAt: null,
    room: null,
    remote: false,
    tenantId: 'acme',
  } as const;

  it('writes on the transaction of the unit of work: a failure takes the row back with it', async () => {
    const { table, unitOfWork } = await emptied();

    const failed = unitOfWork.run(async () => {
      await table.insert({ key: 'a1', row, stamp });

      throw new Error('the handler fails after its write');
    });

    await expect(failed).rejects.toThrow('the handler fails');
    expect(await table.find('a1')).toBeUndefined();
  });

  it('binds every value of a write, and replaces a row only while it holds the stamp that was read', async () => {
    const { table } = await emptied();
    const later = { eventId: 'evt-2', occurredAt: new Date('2026-10-10T12:01:00.000Z') };

    await table.insert({ key: 'a1', row, stamp });

    expect(database.logger.queries.join('\n')).not.toContain('drop table');
    expect(await table.replace({ key: 'a1', row: { ...row, seats: 2 }, stamp: later }, stamp)).toBe(true);
    expect(await table.replace({ key: 'a1', row: { ...row, seats: 3 }, stamp: later }, stamp)).toBe(false);
    expect((await table.find('a1'))?.row).toEqual({ ...row, seats: 2 });
  });

  it('refuses a table declared without the columns of a read model', () => {
    const declare = () =>
      new DrizzleReadModelTable<CriteriaContractRow, PgQueryResultHKT>(createDrizzleUnitOfWork(database.db), {
        ...CONTRACT_TABLE,
        table: plain,
      });

    expect(declare).toThrow('readModelColumns');
  });

  it('refuses, when it is built, a table whose columns could not hold the trace of a deleted row', () => {
    const strict = pgTable('strict_rows', {
      id: text('id').primaryKey(),
      title: text('title').notNull(),
      owner: text('owner').notNull(),
      note: text('note'),
      tenantId: text('tenant_id').notNull(),
      ...readModelColumns(),
    });

    const columns = { id: strict.id, title: strict.title, owner: strict.owner, note: strict.note };

    const declare = () =>
      new DrizzleReadModelTable<{ id: string; title: string; owner: string; note: string | null }, PgQueryResultHKT>(
        createDrizzleUnitOfWork(database.db),
        {
          table: strict,
          key: strict.id,
          columns,
          tenant: { scope: new AsyncLocalStorageExecutionScope(), column: strict.tenantId },
        },
      );

    expect(declare).toThrow(ReadModelTableNotReadyError);

    expect(declare).toThrow(
      'The read model table strict_rows cannot hold the trace of a deleted row: "title", "owner" refuse NULL',
    );

    expect(declare).toThrow('check (deleted or ("title" is not null and "owner" is not null))');
  });
});
