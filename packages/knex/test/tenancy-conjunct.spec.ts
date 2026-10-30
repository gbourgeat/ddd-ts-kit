import type { Knex } from 'knex';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AsyncLocalStorageExecutionScope } from '@ddd-ts-kit/kernel';
import { anExecutionContext, asTenant, scoped } from '@ddd-ts-kit/testing';
import {
  ClearedTenantConditionError,
  UngroupedOrError,
  createKnexUnitOfWork,
  derivedTable,
  ownTenantTable,
  tenantTable,
  whereTenant,
} from '../src';
import { createDatabase, type TestDatabase } from './support/database';

interface LineRow {
  id: string;
  amount: number;
  version: number;
  tenant_id: string;
}

const LINES = { table: 'lines' };

const row = (id: string, tenantId: string, amount: number): LineRow => ({
  id,
  amount,
  version: 1,
  tenant_id: tenantId,
});

let database: TestDatabase;

const scope = new AsyncLocalStorageExecutionScope();
const context = () => createKnexUnitOfWork(database.knex);
const reads = () => tenantTable<LineRow>(context(), scope, LINES);
const writes = () => ownTenantTable<LineRow>(context(), scope, LINES);
const idsOf = (rows: readonly LineRow[]) => rows.map(({ id }) => id).sort();

beforeAll(async () => {
  database = await createDatabase(
    (knex) =>
      knex.schema.createTable(LINES.table, (table) => {
        table.text('id').primary();
        table.integer('amount').notNullable();
        table.integer('version').notNullable();
        table.text('tenant_id').notNullable();
      }),
    [LINES.table],
  );
});

afterAll(async () => {
  await database.close();
});

beforeEach(async () => {
  await database.truncate();

  await database
    .knex(LINES.table)
    .insert([
      row('acme-1', 'acme', 1),
      row('acme-2', 'acme', 2),
      row('globex-1', 'globex', 1),
      row('globex-2', 'globex', 2),
    ]);
});

describe('a statement of a tenant helper', () => {
  it('takes alternatives in a group, and keeps to the tenant', async () => {
    const found = await asTenant(scope, 'acme', () =>
      reads().where((either) => {
        void either.where({ amount: 1 }).orWhere({ amount: 2 });
      }),
    );

    expect(idsOf(found)).toEqual(['acme-1', 'acme-2']);
  });

  it('writes alternatives in a group to the rows of the tenant alone', async () => {
    const changed = await asTenant(scope, 'acme', () =>
      writes()
        .where((either) => {
          void either.where({ amount: 1 }).orWhere({ amount: 2 });
        })
        .update({ version: 2 }),
    );

    expect(changed).toBe(2);
    expect(idsOf(await database.knex<LineRow>(LINES.table).where({ version: 2 }))).toEqual(['acme-1', 'acme-2']);
  });

  it.each([
    ['orWhere', () => reads().where({ amount: 1 }).orWhere({ amount: 2 })],
    ['orWhereNot', () => reads().orWhereNot({ amount: 2 })],
    ['orWhereIn', () => reads().orWhereIn('amount', [2])],
    ['orWhereNull', () => reads().orWhereNull('amount')],
    ['orWhereRaw', () => reads().orWhereRaw('amount = 2')],
    ['or', () => reads().or.where({ amount: 2 })],
    ['orWhere', () => writes().where({ amount: 1 }).orWhere({ amount: 2 })],
    ['orWhere', () => reads().clone().orWhere({ amount: 2 })],
    ['orWhere', () => reads().where({ amount: 1 }).clone().where({ amount: 2 }).orWhere({ amount: 2 })],
    ['orWhere', () => whereTenant(database.knex<LineRow>(LINES.table), scope).orWhere({ amount: 2 })],
    [
      'orWhere',
      () =>
        reads().modify((statement: Knex.QueryBuilder) => {
          void statement.orWhere({ amount: 2 });
        }),
    ],
  ])('refuses %s at its top', async (method, statement) => {
    await asTenant(scope, 'acme', async () => {
      expect(statement).toThrow(new UngroupedOrError(method));
    });
  });

  it.each([
    ['clearWhere', () => reads().clearWhere()],
    [`clear('where')`, () => writes().clear('where')],
    ['clearWhere', () => reads().clone().clearWhere()],
  ])('refuses %s', async (method, statement) => {
    await asTenant(scope, 'acme', async () => {
      expect(statement).toThrow(new ClearedTenantConditionError(method));
    });
  });

  it('clears what is not a condition', async () => {
    const found = await asTenant(scope, 'acme', () => reads().select('amount').clear('select').where({ amount: 1 }));

    expect(found).toEqual([expect.objectContaining({ id: 'acme-1', amount: 1 })]);
  });

  it('takes an orHaving, which applies after the tenant condition', async () => {
    const found = await asTenant(scope, 'acme', () =>
      reads().select('amount').groupBy('amount').having('amount', '=', 1).orHaving('amount', '=', 2),
    );

    expect(found.map(({ amount }) => amount).sort()).toEqual([1, 2]);
  });

  it('refuses an or at its top under an elevation over every tenant as well', async () => {
    const staff = anExecutionContext().ofTenant('initech').elevatedOver('all');

    await scoped(scope, staff, async () => {
      expect(() => reads().orWhere({ amount: 2 })).toThrow(UngroupedOrError);
    });
  });

  it('stays a builder: a clone reads, a subquery and a derived table compose', async () => {
    const found = await asTenant(scope, 'acme', async () => {
      const base = reads().where({ amount: 1 });
      const again = await base.clone();
      const nested = await reads().whereIn('id', reads().select('id').where({ amount: 2 }));

      return { base: await base, again, nested };
    });

    expect(idsOf(found.base)).toEqual(['acme-1']);
    expect(idsOf(found.again)).toEqual(['acme-1']);
    expect(idsOf(found.nested)).toEqual(['acme-2']);
  });

  it('lets a select over a derived table filter its output with an or', async () => {
    const found = await asTenant(scope, 'acme', () =>
      derivedTable<LineRow>(context(), reads(), 'lines_of_tenant').where({ amount: 1 }).orWhere({ amount: 2 }),
    );

    expect(idsOf(found)).toEqual(['acme-1', 'acme-2']);
  });
});

describe('raw text on a statement of a tenant helper is one conjunct', () => {
  const raw = (sql: string, bindings: Knex.RawBinding[] | Knex.ValueDict) => database.knex.raw(sql, bindings);
  const either: [string, [number, string]] = ['amount = ? or id = ?', [1, 'globex-2']];

  it.each([
    ['whereRaw', () => reads().whereRaw(...either)],
    ['andWhereRaw', () => reads().andWhereRaw(...either)],
    ['whereRaw with a raw', () => reads().whereRaw(raw(...either))],
    ['where with a raw', () => reads().where(raw(...either))],
    ['andWhere with a raw', () => reads().andWhere(raw(...either))],
    ['named bindings', () => reads().whereRaw('amount = :amount or id = :id', { amount: 1, id: 'globex-2' })],
    [
      'named bindings in a raw',
      () => reads().where(raw('amount = :amount or id = :id', { amount: 1, id: 'globex-2' })),
    ],
    [
      'a clone',
      () =>
        reads()
          .whereRaw(...either)
          .clone(),
    ],
  ])('in %s', async (_form, statement) => {
    const found = await asTenant(scope, 'acme', statement);

    expect(idsOf(found)).toEqual(['acme-1']);
  });

  it.each([
    ['a value', () => reads().where('amount', raw('1 or id = ?', ['globex-2']))],
    ['a value of an object', () => reads().where({ amount: raw('1 or id = ?', ['globex-2']) })],
  ])('in %s', async (_form, statement) => {
    await asTenant(scope, 'acme', async () => {
      expect(statement().toSQL().sql).toContain('"amount" = (1 or id = ?)');
    });
  });

  it('negated as a whole by whereNot', async () => {
    const found = await asTenant(scope, 'acme', () => reads().whereNot(raw('amount = ? or id = ?', [2, 'globex-1'])));

    expect(idsOf(found)).toEqual(['acme-1']);
  });

  it('on a write', async () => {
    const changed = await asTenant(scope, 'acme', () =>
      writes().whereRaw('amount = ? or id = ?', [1, 'globex-2']).update({ version: 2 }),
    );

    expect(changed).toBe(1);
    expect(idsOf(await database.knex<LineRow>(LINES.table).where({ version: 2 }))).toEqual(['acme-1']);
  });

  it('stays a statement of the helper, which refuses an or after it', async () => {
    await asTenant(scope, 'acme', async () => {
      expect(() => reads().whereRaw('amount = 1').orWhereRaw('amount = 2')).toThrow(UngroupedOrError);
    });
  });
});
