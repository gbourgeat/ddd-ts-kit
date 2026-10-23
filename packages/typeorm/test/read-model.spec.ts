import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readModelStoreContract, type CriteriaContractRow } from '@ddd-ts-kit/testing/contracts';
import { EntitySchema } from 'typeorm';
import { TypeOrmReadModelTable, createTypeOrmUnitOfWork, readModelColumns, type ReadModelStamps } from '../src';
import { createDatabase, type TestDatabase } from './support/database';
import { contractRows } from './support/read-model/criteria-contract-rows';

const runner = { describe, it, expect, beforeEach, afterEach };

interface LedgerRow {
  readonly id: string;
  readonly holder: string;
}

/** A read model in the default schema: its table and the copy of its rebuild are named without a schema. */
const ledgerRows = new EntitySchema<LedgerRow & ReadModelStamps>({
  name: 'LedgerRow',
  tableName: 'ledger',
  columns: { id: { type: 'text', primary: true }, holder: { type: 'text' }, ...readModelColumns() },
});

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase([contractRows, ledgerRows]);
});

afterAll(async () => {
  await database.close();
});

const tableOf = () => {
  const unitOfWork = createTypeOrmUnitOfWork(database.dataSource);

  return { table: new TypeOrmReadModelTable<CriteriaContractRow>(unitOfWork, { entity: contractRows }), unitOfWork };
};

async function emptied() {
  await tableOf().table.abandonRebuild();
  await database.truncate();

  return tableOf();
}

readModelStoreContract(runner, { name: 'TypeOrmReadModelTable', createTable: emptied });

describe('TypeOrmReadModelTable', () => {
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

    expect(database.queries.join('\n')).not.toContain('drop table');
    expect(await table.replace({ key: 'a1', row: { ...row, seats: 2 }, stamp: later }, stamp)).toBe(true);
    expect(await table.replace({ key: 'a1', row: { ...row, seats: 3 }, stamp: later }, stamp)).toBe(false);
    expect((await table.find('a1'))?.row).toEqual({ ...row, seats: 2 });
  });
});

describe('TypeOrmReadModelTable of an entity in the default schema', () => {
  const stamp = { eventId: 'evt-1', occurredAt: new Date('2026-10-10T12:00:00.000Z') };
  const account = { id: 'acct-1', holder: 'Jane Doe' };

  it('writes and reads its rows, and those of the copy of a rebuild, in the default schema', async () => {
    await database.truncate();

    const table = new TypeOrmReadModelTable<LedgerRow>(createTypeOrmUnitOfWork(database.dataSource), {
      entity: ledgerRows,
    });

    await table.insert({ key: 'acct-1', row: account, stamp });
    await table.beginRebuild();
    await table.shadow().insert({ key: 'acct-1', row: { ...account, holder: 'J. Doe' }, stamp });

    expect((await table.find('acct-1'))?.row).toEqual(account);
    expect((await table.shadow().find('acct-1'))?.row).toEqual({ ...account, holder: 'J. Doe' });
    expect(await database.dataSource.query('select count(*)::int as count from public.ledger')).toEqual([{ count: 1 }]);
    await table.abandonRebuild();
  });
});
