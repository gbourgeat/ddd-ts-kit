import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ConcurrencyError,
  UnreadableEventError,
  eventStoreTablesSql,
  postgresEventSourcing,
  type EventSourcingStores,
  type EventToAppend,
  type SqlRun,
} from '../src/index.js';
import { isAppendConflict } from '../src/infrastructure/event-sourcing/postgres/is-append-conflict.js';
import { storedDataFrom } from '../src/infrastructure/event-sourcing/postgres/stored-data-from.js';

describe('the event store on PostgreSQL', () => {
  it('knows an append that lost to another, whatever wraps the error of the driver', () => {
    const duplicate = { code: '23505' };

    expect(isAppendConflict(duplicate)).toBe(true);
    expect(isAppendConflict({ cause: duplicate })).toBe(true);
    expect(isAppendConflict({ driverError: duplicate })).toBe(true);
    expect(isAppendConflict({ meta: duplicate })).toBe(true);
    expect(isAppendConflict({ code: '40001' })).toBe(true);
    expect(isAppendConflict({ driverError: { code: '40P01' } })).toBe(true);
    expect(isAppendConflict({ code: '23503' })).toBe(false);
    expect(isAppendConflict({ code: 23505 })).toBe(false);
    expect(isAppendConflict('23505')).toBe(false);
    expect(isAppendConflict({ cause: { cause: { cause: { cause: { cause: duplicate } } } } })).toBe(false);
  });

  it('reads a JSON column the driver answered as text, and refuses what is not a JSON object', () => {
    expect(storedDataFrom('{"grams":3,"tags":["a",null],"box":{"open":false}}', 'data')).toEqual({
      grams: 3,
      tags: ['a', null],
      box: { open: false },
    });

    expect(() => storedDataFrom('[1]', 'The data of e1')).toThrow(UnreadableEventError);
    expect(() => storedDataFrom({ at: new Date(0) }, 'The data of e1')).toThrow('The data of e1 is not a JSON object');
  });

  it('creates its tables in the schema of the context, quoted, each statement safe to run again', () => {
    const statements = eventStoreTablesSql({ schema: 'scheduling' });

    expect(statements[0]).toBe('create schema if not exists "scheduling"');

    expect(
      statements.slice(1).every((statement) => statement.startsWith('create table if not exists "scheduling".')),
    ).toBe(true);

    expect(eventStoreTablesSql()).toHaveLength(5);
  });
});

/** One in-process PostgreSQL for the file, its tables emptied before each test. */
let database: PGlite;
let stores: EventSourcingStores;

const run: SqlRun = async (statement, parameters) =>
  (await database.query<Readonly<Record<string, unknown>>>(statement, [...parameters])).rows;

const weighed = (id: string, grams: number): EventToAppend => ({
  id,
  type: 'shipping.parcel.weighed',
  schemaVersion: 1,
  data: { grams },
  occurredAt: new Date('2026-10-18T09:30:00.250Z'),
});

beforeAll(async () => {
  database = new PGlite();

  for (const statement of eventStoreTablesSql({ schema: 'shipping' })) {
    await database.exec(statement);
  }

  stores = postgresEventSourcing(run, { schema: 'shipping' });
});

afterAll(async () => {
  await database.close();
});

beforeEach(async () => {
  await database.exec(
    'truncate table "shipping"."stored_events", "shipping"."stored_events_head", "shipping"."stream_snapshots", "shipping"."subscription_checkpoints", "shipping"."subject_keys"',
  );
});

describe('PostgresEventStore on an in-process PostgreSQL', () => {
  it('places the events of an append after the head of the store, and reads them back as they were', async () => {
    const { events } = stores;

    expect(await events.head()).toBe(0);

    expect(await events.append('parcel-1', 0, [weighed('e1', 300), weighed('e2', 320)])).toEqual({
      version: 2,
      position: 2,
    });

    expect(await events.append('parcel-2', 0, [{ ...weighed('e3', 90), metadata: { correlationId: 'c-7' } }])).toEqual({
      version: 1,
      position: 3,
    });

    const stream = await events.readStream('parcel-1');

    expect(stream).toEqual([
      {
        id: 'e1',
        stream: 'parcel-1',
        version: 1,
        position: 1,
        type: 'shipping.parcel.weighed',
        schemaVersion: 1,
        data: { grams: 300 },
        metadata: {},
        occurredAt: new Date('2026-10-18T09:30:00.250Z'),
      },
      expect.objectContaining({ id: 'e2', version: 2, position: 2, data: { grams: 320 } }),
    ]);

    expect(await events.head()).toBe(3);
    expect((await events.readStream('parcel-1', 1)).map(({ id }) => id)).toEqual(['e2']);
    expect((await events.readAll(1, 1)).map(({ id, metadata }) => [id, metadata])).toEqual([['e2', {}]]);

    expect((await events.readAll(2, 10)).map(({ id, metadata }) => [id, metadata])).toEqual([
      ['e3', { correlationId: 'c-7' }],
    ]);
  });

  it('refuses an append made from a version the stream no longer has, and keeps nothing of it', async () => {
    const { events } = stores;

    await events.append('parcel-1', 0, [weighed('e1', 300)]);

    await expect(events.append('parcel-1', 0, [weighed('e2', 310)])).rejects.toThrow(ConcurrencyError);
    await expect(events.append('parcel-1', 2, [weighed('e2', 310)])).rejects.toThrow(ConcurrencyError);

    expect((await events.readStream('parcel-1')).map(({ id }) => id)).toEqual(['e1']);
    expect(await events.head()).toBe(1);
  });

  it('takes an event appended twice for a conflict, and lets any other failure of the database through', async () => {
    const { events } = stores;

    await events.append('parcel-1', 0, [weighed('e1', 300)]);

    await expect(events.append('parcel-2', 0, [weighed('e1', 300)])).rejects.toThrow(ConcurrencyError);

    const failure = await events.append('parcel-2', 0, [{ ...weighed('e2', 1), schemaVersion: 1.5 }]).then(
      () => undefined,
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(ConcurrencyError);
  });

  it('answers an append of no event with where the stream and the store stand, when the version is the right one', async () => {
    const { events } = stores;

    expect(await events.append('parcel-1', 0, [])).toEqual({ version: 0, position: 0 });

    await events.append('parcel-1', 0, [weighed('e1', 300), weighed('e2', 320)]);
    await events.append('parcel-2', 0, [weighed('e3', 90)]);

    expect(await events.append('parcel-1', 2, [])).toEqual({ version: 2, position: 3 });
    await expect(events.append('parcel-1', 1, [])).rejects.toThrow(ConcurrencyError);
  });
});

describe('PostgresSnapshotStore on an in-process PostgreSQL', () => {
  it('keeps one snapshot per stream, never replaced by an older version', async () => {
    const { snapshots } = stores;

    expect(await snapshots.find('parcel-1')).toBeUndefined();

    await snapshots.save({ stream: 'parcel-1', version: 5, schemaVersion: 1, data: { grams: 500 } });
    await snapshots.save({ stream: 'parcel-1', version: 3, schemaVersion: 1, data: { grams: 300 } });

    expect(await snapshots.find('parcel-1')).toEqual({
      stream: 'parcel-1',
      version: 5,
      schemaVersion: 1,
      data: { grams: 500 },
    });

    await snapshots.save({ stream: 'parcel-1', version: 8, schemaVersion: 2, data: { kilograms: 0.8 } });

    expect(await snapshots.find('parcel-1')).toEqual({
      stream: 'parcel-1',
      version: 8,
      schemaVersion: 2,
      data: { kilograms: 0.8 },
    });
  });
});

describe('PostgresCheckpointStore on an in-process PostgreSQL', () => {
  it('starts a subscriber at zero and moves it only from the position it holds', async () => {
    const { checkpoints } = stores;

    expect(await checkpoints.position('parcel-list')).toBe(0);

    await checkpoints.advance('parcel-list', 0, 4);
    await checkpoints.advance('parcel-list', 4, 9);

    expect(await checkpoints.position('parcel-list')).toBe(9);
    await expect(checkpoints.advance('parcel-list', 4, 12)).rejects.toThrow(ConcurrencyError);
    await expect(checkpoints.advance('parcel-list', 0, 12)).rejects.toThrow(ConcurrencyError);
    await expect(checkpoints.advance('parcel-report', 3, 12)).rejects.toThrow(ConcurrencyError);
    expect(await checkpoints.position('parcel-list')).toBe(9);
    expect(await checkpoints.position('parcel-report')).toBe(0);
  });
});

describe('PostgresSubjectKeyStore on an in-process PostgreSQL', () => {
  it('creates the key of a subject once, finds it by its id, and forgets it for good when erased', async () => {
    const { subjectKeys } = stores;

    const key = await subjectKeys.keyFor('customer-7');

    expect(key.subject).toBe('customer-7');
    expect(Buffer.from(key.material, 'base64')).toHaveLength(32);
    expect(await subjectKeys.keyFor('customer-7')).toEqual(key);
    expect(await subjectKeys.find(key.id)).toEqual(key);
    expect(await subjectKeys.find('no-such-key')).toBeUndefined();

    expect(await subjectKeys.erase('customer-7')).toBe(true);
    expect(await subjectKeys.erase('customer-7')).toBe(false);
    expect(await subjectKeys.find(key.id)).toBeUndefined();
    expect((await subjectKeys.keyFor('customer-7')).id).not.toBe(key.id);
  });
});
