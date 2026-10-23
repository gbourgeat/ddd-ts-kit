import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readModelStoreContract, type CriteriaContractRow } from '@ddd-ts-kit/testing/contracts';
import { PrismaReadModelTable, createPrismaUnitOfWork } from '../../src';
import type { Prisma } from '../generated/client/client';
import { createDatabase, type TestDatabase } from '../support/database';
import { CONTRACT_MODEL } from '../support/read-model/contract-model';

const runner = { describe, it, expect, beforeEach, afterEach };

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase();
});

afterAll(async () => {
  await database.close();
});

const tableOf = () => {
  const unitOfWork = createPrismaUnitOfWork(database.prisma);

  return {
    table: new PrismaReadModelTable<CriteriaContractRow, Prisma.TransactionClient>(unitOfWork, CONTRACT_MODEL),
    unitOfWork,
  };
};

async function emptied() {
  await tableOf().table.abandonRebuild();
  await database.truncate();

  return tableOf();
}

readModelStoreContract(runner, { name: 'PrismaReadModelTable', createTable: emptied });

describe('PrismaReadModelTable', () => {
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

  it('binds every value written to the copy of a rebuild, which has no model', async () => {
    const { table } = await emptied();

    await table.beginRebuild();
    database.queries.length = 0;
    await table.shadow().insert({ key: 'a1', row, stamp });

    expect(database.queries.join('\n')).not.toContain('drop table');
    expect((await table.shadow().find('a1'))?.row).toEqual(row);
    await table.abandonRebuild();
  });
});
