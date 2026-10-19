import { PGlite, type Transaction } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ConcurrencyError,
  InMemoryReadModelStore,
  PostgresReadModelRebuild,
  defineCriteria,
  isNewer,
  stampOf,
  writeIfNewer,
  type DomainEvent,
  type EventStamp,
  type IntegrationEvent,
  type ReadModelRows,
  type SqlRun,
  type StampedRow,
} from '../src/index.js';

interface PatientRow {
  readonly id: string;
  readonly name: string;
}

const patients = defineCriteria<PatientRow>({
  fields: { id: { type: 'string' }, name: { type: 'string', sortable: true } },
  tieBreaker: 'id',
});

const at = (eventId: string, second: number, version?: number): EventStamp => ({
  eventId,
  occurredAt: new Date(Date.UTC(2026, 9, 10, 12, 0, second)),
  ...(version === undefined ? {} : { version }),
});

describe('event stamps', () => {
  it('reads the stamp of an integration event and of a domain event', () => {
    const integration: IntegrationEvent = {
      id: 'evt-1',
      type: 'registry.patient.registered',
      version: 1,
      occurredAt: '2026-10-10T12:00:01.000Z',
      payload: {},
    };

    const domain: DomainEvent = {
      name: 'clinic.visit.scheduled',
      aggregateId: 'visit-7',
      occurredAt: new Date('2026-10-10T12:00:02.000Z'),
    };

    expect(stampOf(integration)).toEqual(at('evt-1', 1));
    expect(stampOf(domain)).toEqual(at('clinic.visit.scheduled:visit-7', 2));
    expect(stampOf(integration, 12)).toEqual(at('evt-1', 1, 12));
  });

  it.each([
    ['a later instant', at('a', 2), at('z', 1), true],
    ['an earlier instant', at('z', 1), at('a', 2), false],
    ['the same event', at('a', 1), at('a', 1), false],
    ['the same instant and a greater id', at('b', 1), at('a', 1), true],
    ['the same instant and a smaller id', at('a', 1), at('b', 1), false],
    ['a greater version, whatever the instant', at('a', 1, 3), at('z', 9, 2), true],
    ['the same version', at('b', 9, 2), at('a', 1, 2), false],
    ['a version against none: the instants decide', at('a', 1, 9), at('z', 2), false],
  ])('%s', (_label, incoming, held, newer) => {
    expect(isNewer(incoming, held)).toBe(newer);
  });
});

describe('writeIfNewer', () => {
  /** Rows whose every conditional write is lost to a concurrent writer. */
  class ContendedRows implements ReadModelRows<PatientRow> {
    reads = 0;

    async find(key: string): Promise<StampedRow<PatientRow>> {
      this.reads += 1;

      return { key, row: { id: key, name: 'held' }, stamp: at('evt-0', 0) };
    }

    async insert(): Promise<boolean> {
      return false;
    }

    async replace(): Promise<boolean> {
      return false;
    }
  }

  it('reads again when another write got there first, and gives up after five times', async () => {
    const rows = new ContendedRows();

    await expect(
      writeIfNewer(rows, { key: 'p1', stamp: at('evt-1', 1), next: () => ({ id: 'p1', name: 'new' }) }),
    ).rejects.toThrow(ConcurrencyError);

    expect(rows.reads).toBe(5);
  });
});

describe('InMemoryReadModelStore', () => {
  it('answers copies: changing what it gave or what it was given changes nothing it holds', async () => {
    const store = new InMemoryReadModelStore(patients);
    const written = { id: 'p1', name: 'Ada' };

    await store.upsertIfNewer('p1', at('evt-1', 1), () => written);
    written.name = 'changed after';
    Object.assign((await store.get('p1')) ?? {}, { name: 'changed outside' });

    expect(await store.get('p1')).toEqual({ id: 'p1', name: 'Ada' });
  });
});

describe('PostgresReadModelRebuild', () => {
  const recording = (answers: Readonly<Record<string, unknown>>[] = []) => {
    const statements: [string, readonly unknown[]][] = [];

    const run = async (statement: string, parameters: readonly unknown[]) => {
      statements.push([statement, parameters]);

      return answers;
    };

    return { statements, run };
  };

  it('quotes every identifier and binds every value', async () => {
    const { statements, run } = recording();
    const rebuild = new PostgresReadModelRebuild(run, { schema: 'sched"uling', table: 'appointment_list' });

    await rebuild.touch("a1'; drop table x; --");
    await rebuild.settle([{ key: 'a1', mark: 2 }]);

    expect(statements).toEqual([
      [
        'insert into "sched""uling"."appointment_list__touched" as touched ("key") values ($1) on conflict ("key") do update set "mark" = touched."mark" + 1',
        ["a1'; drop table x; --"],
      ],
      ['delete from "sched""uling"."appointment_list__touched" where "key" = $1 and "mark" = $2', ['a1', 2]],
    ]);
  });

  it('holds the writers on the touched keys first, then swaps by renaming', async () => {
    const { statements, run } = recording();
    const rebuild = new PostgresReadModelRebuild(run, { table: 'patients' });

    await rebuild.holdWriters();
    await rebuild.promote();

    expect(statements.map(([statement]) => statement)).toEqual([
      'lock table "patients__touched", "patients" in access exclusive mode',
      'alter table "patients" rename to "patients__retired"',
      'alter table "patients__rebuild" rename to "patients"',
      'drop table "patients__retired"',
      'drop table "patients__touched"',
    ]);
  });

  it('says a rebuild is in progress while the table of touched keys exists', async () => {
    const asked = recording([{ rebuilding: true }]);

    expect(await new PostgresReadModelRebuild(asked.run, { table: 'patients' }).rebuilding()).toBe(true);
    expect(await new PostgresReadModelRebuild(recording().run, { table: 'patients' }).rebuilding()).toBe(false);
    expect(asked.statements).toEqual([['select to_regclass($1) is not null as rebuilding', ['"patients__touched"']]]);
  });
});

describe('PostgresReadModelRebuild on an in-process PostgreSQL', () => {
  let database: PGlite;

  const runOn =
    (executor: Pick<Transaction, 'query'>): SqlRun =>
    async (statement, parameters) =>
      (await executor.query<Readonly<Record<string, unknown>>>(statement, [...parameters])).rows;

  const names = async (table: string): Promise<string[]> =>
    (await database.query<{ name: string }>(`select name from ${table} order by id`)).rows.map(({ name }) => name);

  beforeAll(() => {
    database = new PGlite();
  });

  afterAll(async () => {
    await database.close();
  });

  beforeEach(async () => {
    await database.exec(`
      drop schema if exists lodging cascade;
      create schema lodging;
      create table lodging.rooms (id text primary key, name text not null, deleted boolean not null default false);
      insert into lodging.rooms values ('r1', 'Lavender', false), ('r2', 'Basil', true), ('r3', 'Cedar', false);
    `);
  });

  it('opens a copy holding the deleted rows only, and records the keys written meanwhile, counting each write', async () => {
    const rebuild = new PostgresReadModelRebuild(runOn(database), { schema: 'lodging', table: 'rooms' });

    expect(await rebuild.rebuilding()).toBe(false);

    await rebuild.begin();
    await rebuild.touch('r3');
    await rebuild.touch('r1');
    await rebuild.touch('r3');

    expect(await rebuild.rebuilding()).toBe(true);
    expect(await names('lodging.rooms__rebuild')).toEqual(['Basil']);

    expect(await rebuild.touched(10)).toEqual([
      { key: 'r1', mark: 1 },
      { key: 'r3', mark: 2 },
    ]);

    expect(await rebuild.touched(1)).toEqual([{ key: 'r1', mark: 1 }]);
  });

  it('settles a key only when it was not written again since it was read', async () => {
    const rebuild = new PostgresReadModelRebuild(runOn(database), { schema: 'lodging', table: 'rooms' });

    await rebuild.begin();
    await rebuild.touch('r1');
    await rebuild.touch('r3');

    const read = await rebuild.touched(10);

    await rebuild.touch('r3');
    await rebuild.settle(read);

    expect(await rebuild.touched(10)).toEqual([{ key: 'r3', mark: 2 }]);
  });

  it('puts the copy in place of the table in one transaction, with the writers held', async () => {
    const rebuild = new PostgresReadModelRebuild(runOn(database), { schema: 'lodging', table: 'rooms' });

    await rebuild.begin();
    await database.exec(`insert into lodging.rooms__rebuild values ('r1', 'Lavender', false), ('r4', 'Thyme', false)`);

    await database.transaction(async (transaction) => {
      const swap = new PostgresReadModelRebuild(runOn(transaction), { schema: 'lodging', table: 'rooms' });

      await swap.holdWriters();
      await swap.promote();
    });

    expect(await names('lodging.rooms')).toEqual(['Lavender', 'Basil', 'Thyme']);
    expect(await rebuild.rebuilding()).toBe(false);

    expect(
      (
        await database.query(
          `select to_regclass('lodging.rooms__rebuild') as copy, to_regclass('lodging.rooms__retired') as retired`,
        )
      ).rows,
    ).toEqual([{ copy: null, retired: null }]);
  });

  it('drops what an abandoned rebuild opened and leaves the table as it was, even when nothing was opened', async () => {
    await database.exec(`
      create table lodging.desks (id text primary key, name text not null, removed boolean not null default false);
      insert into lodging.desks values ('d1', 'Oak', false), ('d2', 'Pine', true);
    `);

    const rebuild = new PostgresReadModelRebuild(runOn(database), {
      schema: 'lodging',
      table: 'desks',
      deletedColumn: 'removed',
    });

    await rebuild.abandon();
    await rebuild.begin();

    expect(await names('lodging.desks__rebuild')).toEqual(['Pine']);

    await rebuild.abandon();

    expect(await rebuild.rebuilding()).toBe(false);
    expect(await names('lodging.desks')).toEqual(['Oak', 'Pine']);
  });
});
