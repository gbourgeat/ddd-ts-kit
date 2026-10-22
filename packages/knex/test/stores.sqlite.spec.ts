import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { outboxStoreContract, processedEventStoreContract } from '@ddd-ts-kit/testing/contracts';
import {
  KnexOutboxStore,
  KnexProcessedEventStore,
  createKnexUnitOfWork,
  createOutboxTables,
  dropOutboxTables,
} from '../src';
import { createSqliteDatabase, type TestSqliteDatabase } from './support/sqlite';

const runner = { describe, it, expect, beforeEach, afterEach };

let database: TestSqliteDatabase;

beforeAll(async () => {
  database = await createSqliteDatabase(
    async (knex) => {
      await createOutboxTables(knex);

      await createOutboxTables(knex, {
        outboxTable: 'billing_outbox',
        processedEventsTable: 'billing_processed_events',
        tenant: true,
      });
    },
    ['outbox', 'processed_events', 'billing_outbox', 'billing_processed_events'],
  );
});

afterAll(async () => {
  await database.close();
});

const context = () => createKnexUnitOfWork(database.knex);

outboxStoreContract(runner, {
  name: 'KnexOutboxStore on SQLite, claiming by compare-and-set',
  leaseMs: 30_000,
  createStore: async () => {
    await database.truncate();

    return new KnexOutboxStore(context(), { claim: 'compare-and-set' });
  },
});

// Without a claim named, SQLite, which has no row lock, is claimed by compare-and-set.
outboxStoreContract(runner, {
  name: 'KnexOutboxStore on SQLite, choosing how to claim by itself',
  leaseMs: 30_000,
  createStore: async () => {
    await database.truncate();

    return new KnexOutboxStore(context());
  },
});

outboxStoreContract(runner, {
  name: 'KnexOutboxStore on SQLite in tables named for the context, keeping the tenant of each event',
  leaseMs: 5_000,
  carriesTenant: true,
  createStore: async () => {
    await database.truncate();

    return new KnexOutboxStore(context(), {
      table: 'billing_outbox',
      claim: 'compare-and-set',
      leaseMs: 5_000,
      tenant: true,
    });
  },
});

processedEventStoreContract(runner, {
  name: 'KnexProcessedEventStore on SQLite',
  createStore: async () => {
    await database.truncate();

    return new KnexProcessedEventStore(context());
  },
});

processedEventStoreContract(runner, {
  name: 'KnexProcessedEventStore on SQLite in a table named for the context',
  createStore: async () => {
    await database.truncate();

    return new KnexProcessedEventStore(context(), { table: 'billing_processed_events' });
  },
});

describe('createOutboxTables on SQLite', () => {
  it('refuses a schema, which SQLite does not have', async () => {
    await expect(createOutboxTables(database.knex, { schema: 'messaging' })).rejects.toThrow(
      'SQLite has no schemas: name the tables per context with outboxTable and processedEventsTable',
    );
  });

  it('is undone by dropOutboxTables under the default names, as it is done under them', async () => {
    const present = () =>
      Promise.all(['outbox', 'processed_events'].map((table) => database.knex.schema.hasTable(table)));

    await dropOutboxTables(database.knex);
    const dropped = await present();

    await createOutboxTables(database.knex);

    expect(dropped).toEqual([false, false]);
    expect(await present()).toEqual([true, true]);
  });
});
