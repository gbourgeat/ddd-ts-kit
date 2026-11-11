import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readModelStoreContract, type CriteriaContractRow } from '@ddd-ts-kit/testing/contracts';
import { AsyncLocalStorageExecutionScope, ReadModelTableNotReadyError } from '@ddd-ts-kit/kernel';
import { asTenant } from '@ddd-ts-kit/testing';
import { PrismaReadModelTable, createPrismaUnitOfWork, type PrismaReadModelOptions } from '../../src';
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

/** What the table holds under a key, by field of the row, read beside the store. */
async function stored(key: string) {
  const rows = await database.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    'select id, status, title, seats, price::text, starts_at as "startsAt", cancelled_at as "cancelledAt", room, remote, tenant_id as "tenantId" from read_side.criteria_contract where id = $1',
    key,
  );

  return rows[0];
}

readModelStoreContract(runner, { name: 'PrismaReadModelTable', createTable: emptied, stored, uniqueTitle: true });

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

interface LedgerRow {
  readonly id: string;
  readonly balance: number;
}

const LEDGER_MODEL: PrismaReadModelOptions<LedgerRow, Prisma.TransactionClient> = {
  delegate: (client) => client.ledgerRow,
  table: 'ledger',
  columns: { id: 'id', balance: 'balance' },
};

describe('PrismaReadModelTable of a model in the default schema', () => {
  const stamp = { eventId: 'evt-1', occurredAt: new Date('2026-10-10T12:00:00.000Z'), version: 3 };
  const account = { id: 'acct-1', balance: Number.MAX_SAFE_INTEGER };

  const ledger = async () => {
    await database.truncate();

    return new PrismaReadModelTable<LedgerRow, Prisma.TransactionClient>(
      createPrismaUnitOfWork(database.prisma),
      LEDGER_MODEL,
    );
  };

  it('reads a BigInt back as a number, from the model and from the copy of a rebuild', async () => {
    const table = await ledger();

    await table.insert({ key: 'acct-1', row: account, stamp });
    await table.beginRebuild();
    await table.shadow().insert({ key: 'acct-1', row: account, stamp });

    expect(await table.find('acct-1')).toEqual({ key: 'acct-1', row: account, stamp });
    expect(await table.shadow().find('acct-1')).toEqual({ key: 'acct-1', row: account, stamp });
    await table.abandonRebuild();
  });

  it('writes to the copy the trace of a deleted row, which has no model either', async () => {
    const table = await ledger();

    await table.beginRebuild();

    expect(await table.shadow().insert({ key: 'acct-2', row: undefined, stamp })).toBe(true);
    expect(await table.shadow().find('acct-2')).toEqual({ key: 'acct-2', row: undefined, stamp });
    await table.abandonRebuild();
  });
});

interface StrictRow {
  readonly id: string;
  readonly title: string;
  readonly note: string | null;
}

/** A read model as it was declared before a deleted row kept no data: `title` refuses NULL. */
const STRICT_MODEL: PrismaReadModelOptions<StrictRow, Prisma.TransactionClient> = {
  delegate: (client) => client.strictRow,
  table: 'strict_rows',
  columns: { id: 'id', title: 'title', note: 'note' },
};

describe('PrismaReadModelTable of a table whose columns refuse NULL', () => {
  const stamp = { eventId: 'evt-1', occurredAt: new Date('2026-10-10T12:00:00.000Z') };
  const later = { eventId: 'evt-2', occurredAt: new Date('2026-10-10T12:01:00.000Z') };
  const scope = new AsyncLocalStorageExecutionScope();

  const strict = async (schema?: string) => {
    await database.truncate();

    const unitOfWork = createPrismaUnitOfWork(database.prisma);
    const options = { ...STRICT_MODEL, tenant: { scope }, ...(schema === undefined ? {} : { schema }) };

    return { table: new PrismaReadModelTable<StrictRow, Prisma.TransactionClient>(unitOfWork, options), unitOfWork };
  };

  it('refuses the trace of a deleted row by name, before any statement the database would refuse', async () => {
    const { table, unitOfWork } = await strict();

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
    const { table } = await strict('public');

    await asTenant(scope, 'acme', async () => {
      await table.insert({ key: 's1', row: { id: 's1', title: 'held', note: 'n' }, stamp });

      await expect(table.replace({ key: 's1', row: undefined, stamp: later }, stamp)).rejects.toThrow(
        'The read model table public.strict_rows cannot hold the trace of a deleted row: "title" refuses NULL',
      );

      await expect(table.shadow().insert({ key: 's3', row: undefined, stamp })).rejects.toThrow(
        ReadModelTableNotReadyError,
      );

      expect((await table.find('s1'))?.row).toEqual({ id: 's1', title: 'held', note: 'n' });
    });
  });
});
