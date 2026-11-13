import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readModelStoreContract, type CriteriaContractRow } from '@ddd-ts-kit/testing/contracts';
import {
  AsyncLocalStorageExecutionScope,
  Criteria,
  FixedExecutionScope,
  ReadModelTableNotReadyError,
  defineCriteria,
  scoped,
  type TenantScoped,
} from '@ddd-ts-kit/kernel';
import { anExecutionContext } from '@ddd-ts-kit/testing';
import { EntitySchema } from 'typeorm';
import {
  TypeOrmReadModelStore,
  TypeOrmReadModelTable,
  createTypeOrmUnitOfWork,
  readModelColumns,
  tenantColumn,
  type ReadModelStamps,
} from '../src';
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
  columns: { id: { type: 'text', primary: true }, holder: { type: 'text', nullable: true }, ...readModelColumns() },
});

/** A read model of tenant data whose rows do not carry their tenant: the column is the store's, not a field of the row. */
const tenantLedgerRows = new EntitySchema<LedgerRow & TenantScoped & ReadModelStamps>({
  name: 'TenantLedgerRow',
  tableName: 'tenant_ledger',
  columns: {
    id: { type: 'text', primary: true },
    holder: { type: 'text', nullable: true },
    tenantId: { ...tenantColumn().tenantId, select: false },
    ...readModelColumns(),
  },
});

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase([contractRows, ledgerRows, tenantLedgerRows]);
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

/** What the table holds under a key, by field of the row, read beside the store. */
async function stored(key: string) {
  const rows: Record<string, unknown>[] = await database.dataSource.query(
    'select id, status, title, seats, price, starts_at as "startsAt", cancelled_at as "cancelledAt", room, remote, tenant_id as "tenantId" from read_side.criteria_contract where id = $1',
    [key],
  );

  return rows[0];
}

readModelStoreContract(runner, { name: 'TypeOrmReadModelTable', createTable: emptied, stored, uniqueTitle: true });

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

describe('TypeOrmReadModelTable of an entity whose columns refuse NULL', () => {
  interface StrictRow {
    readonly id: string;
    readonly title: string;
    readonly note: string | null;
    readonly tenantId: string;
  }

  const columns = {
    id: { type: 'text', primary: true },
    title: { type: 'text' },
    note: { type: 'text', nullable: true },
    tenantId: { name: 'tenant_id', type: 'text' },
    ...readModelColumns(),
  } as const;

  const declare = (schema?: string) => () =>
    new TypeOrmReadModelTable<StrictRow>(createTypeOrmUnitOfWork(database.dataSource), {
      entity: new EntitySchema<StrictRow & ReadModelStamps>({
        name: 'StrictRow',
        ...(schema === undefined ? {} : { schema, tableName: 'strict_rows' }),
        columns,
      }),
      ...(schema === undefined ? {} : { tenant: { scope: new AsyncLocalStorageExecutionScope() } }),
    });

  it('refuses it when it is built, naming the columns to make nullable and the check constraint', () => {
    expect(declare()).toThrow(ReadModelTableNotReadyError);

    expect(declare()).toThrow(
      'The read model table strict_row cannot hold the trace of a deleted row: "title", "tenant_id" refuse NULL',
    );

    expect(declare()).toThrow('The definition the store reads says so: declare these columns nullable there');
  });

  it('names the mark of a deleted row after its property when the entity gives its column no name', () => {
    const unnamed = () =>
      new TypeOrmReadModelTable<StrictRow>(createTypeOrmUnitOfWork(database.dataSource), {
        entity: new EntitySchema<StrictRow & ReadModelStamps>({
          name: 'StrictRow',
          columns: { ...columns, deleted: { type: 'boolean', default: false } },
        }),
      });

    expect(unnamed).toThrow(expect.objectContaining({ state: expect.objectContaining({ deleted: 'deleted' }) }));
  });

  it('leaves the tenant of a read model of tenant data out of it', () => {
    expect(declare('read_side')).toThrow(
      'The read model table read_side.strict_rows cannot hold the trace of a deleted row: "title" refuses NULL',
    );
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

  it('refuses a trace by name when the database is behind the entity, before the statement it would refuse', async () => {
    await database.truncate();
    await database.dataSource.query('alter table public.ledger alter column holder set not null');

    const unitOfWork = createTypeOrmUnitOfWork(database.dataSource);
    const table = new TypeOrmReadModelTable<LedgerRow>(unitOfWork, { entity: ledgerRows });

    const written = unitOfWork.run(async () => {
      const refusal = await table.insert({ key: 'acct-2', row: undefined, stamp }).catch((error: unknown) => error);

      // The transaction is still usable: nothing was sent that PostgreSQL refused.
      await table.insert({ key: 'acct-1', row: account, stamp });

      return refusal;
    });

    await expect(written).resolves.toMatchObject({ table: 'ledger', columns: ['holder'] });
    expect((await table.find('acct-1'))?.row).toEqual(account);
    await database.dataSource.query('alter table public.ledger alter column holder drop not null');
  });
});

describe('TypeOrmReadModelStore of tenant data, its tenant column declared `select: false`', () => {
  const stamp = { eventId: 'evt-1', occurredAt: new Date('2026-10-10T12:00:00.000Z') };
  const account = { id: 'acct-1', holder: 'Jane Doe' };
  const everything = { kind: 'all' } as const;

  const storeOf = (tenant: string) =>
    new TypeOrmReadModelStore<LedgerRow>(createTypeOrmUnitOfWork(database.dataSource), {
      entity: tenantLedgerRows,
      tenant: { scope: new FixedExecutionScope(anExecutionContext().ofTenant(tenant).build()) },
      definition: defineCriteria<LedgerRow>({
        fields: { id: { type: 'string' }, holder: { type: 'string' } },
        tieBreaker: 'id',
      }),
    });

  it('writes the tenant of the work, confines the reads to it, and answers rows without it', async () => {
    await database.truncate();
    await storeOf('acme').upsertIfNewer('acct-1', stamp, () => account);

    const listed = await storeOf('acme').search(scoped(Criteria.of<LedgerRow>(), everything));
    const stored: unknown = await database.dataSource.query('select tenant_id from public.tenant_ledger');

    expect(await storeOf('acme').get('acct-1')).toEqual(account);
    expect(listed.items).toEqual([account]);
    expect(stored).toEqual([{ tenant_id: 'acme' }]);
    expect(await storeOf('globex').get('acct-1')).toBeUndefined();
  });
});
