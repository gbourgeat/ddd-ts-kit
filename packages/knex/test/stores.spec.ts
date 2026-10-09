import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { outboxStoreContract, processedEventStoreContract } from '@ddd-ts-kit/testing/contracts';
import {
  KnexOutboxStore,
  KnexProcessedEventStore,
  createKnexUnitOfWork,
  createOutboxTables,
  dropOutboxTables,
} from '../src/index.js';
import { createDatabase, type TestDatabase } from './support/database.js';

const runner = { describe, it, expect, beforeEach, afterEach };

let database: TestDatabase;
beforeAll(async () => {
  database = await createDatabase(
    async (knex) => {
      await createOutboxTables(knex, { schema: 'messaging' });
      await createOutboxTables(knex);
    },
    ['messaging.outbox', 'messaging.processed_events', 'outbox', 'processed_events'],
  );
});
afterAll(async () => {
  await database.close();
});

const context = () => createKnexUnitOfWork(database.knex);
const now = new Date('2026-03-01T10:00:00.000Z');
const event = (id: string): IntegrationEvent => ({
  id,
  type: 'billing.invoice.issued',
  version: 1,
  occurredAt: now.toISOString(),
  payload: { invoiceId: id },
});

outboxStoreContract(runner, {
  name: 'KnexOutboxStore in a schema of its own',
  leaseMs: 30_000,
  createStore: async () => {
    await database.truncate();
    return new KnexOutboxStore(context(), { schema: 'messaging', leaseMs: 30_000 });
  },
});

outboxStoreContract(runner, {
  name: 'KnexOutboxStore in the default schema',
  leaseMs: 5_000,
  createStore: async () => {
    await database.truncate();
    return new KnexOutboxStore(context(), { leaseMs: 5_000 });
  },
});

outboxStoreContract(runner, {
  name: 'KnexOutboxStore claiming by compare-and-set',
  leaseMs: 30_000,
  createStore: async () => {
    await database.truncate();
    return new KnexOutboxStore(context(), { schema: 'messaging', claim: 'compare-and-set' });
  },
});

processedEventStoreContract(runner, {
  name: 'KnexProcessedEventStore in a schema of its own',
  createStore: async () => {
    await database.truncate();
    return new KnexProcessedEventStore(context(), { schema: 'messaging' });
  },
});

processedEventStoreContract(runner, {
  name: 'KnexProcessedEventStore in the default schema',
  createStore: async () => {
    await database.truncate();
    return new KnexProcessedEventStore(context());
  },
});

describe('createOutboxTables', () => {
  const indexes = async (table: string): Promise<string[]> => {
    const { rows } = await database.knex.raw<{ rows: { indexdef: string }[] }>(
      "select indexdef from pg_indexes where schemaname = 'messaging' and tablename = ? order by indexname",
      [table],
    );
    return rows.map((row) => row.indexdef);
  };

  it('places the tables in the given schema, or in the default one', async () => {
    const inSchema = (name: string) => database.knex.schema.withSchema(name);

    expect(await inSchema('messaging').hasTable('outbox')).toBe(true);
    expect(await inSchema('messaging').hasTable('processed_events')).toBe(true);
    expect(await inSchema('public').hasTable('outbox')).toBe(true);
    expect(await inSchema('public').hasTable('processed_events')).toBe(true);
  });

  it('indexes the pending records by next attempt, and only those', async () => {
    expect(await indexes('outbox')).toContainEqual(
      expect.stringMatching(/outbox_pending_idx .*\(next_attempt_at, sequence\) WHERE .*status.* = 'pending'/),
    );
  });

  it('makes (consumer, event_id) unique', async () => {
    expect(await indexes('processed_events')).toEqual([
      expect.stringMatching(/UNIQUE INDEX .* \(consumer, event_id\)/),
    ]);
  });

  it('is undone by dropOutboxTables', async () => {
    const names = { outboxTable: 'outbox_tmp', processedEventsTable: 'processed_tmp' };
    await createOutboxTables(database.knex, names);
    expect(await database.knex.schema.hasTable('outbox_tmp')).toBe(true);

    await dropOutboxTables(database.knex, names);

    expect(await database.knex.schema.hasTable('outbox_tmp')).toBe(false);
    expect(await database.knex.schema.hasTable('processed_tmp')).toBe(false);
  });
});

describe('KnexOutboxStore.claimBatch', () => {
  beforeEach(async () => {
    await database.truncate();
  });

  it('locks the due rows with FOR UPDATE SKIP LOCKED inside one transaction', async () => {
    const store = new KnexOutboxStore(context(), { schema: 'messaging' });
    await store.append([event('evt-1')]);
    database.queries.length = 0;

    await store.claimBatch(10, now);

    expect(database.queries).toEqual([
      'BEGIN;',
      expect.stringMatching(
        /^select \* from "messaging"\."outbox" where "status" = \$1 and "next_attempt_at" <= \$2 order by "next_attempt_at" asc, "sequence" asc limit \$3 for update skip locked$/,
      ),
      expect.stringMatching(/^update "messaging"\."outbox" set "attempts" = "attempts" \+ 1, "next_attempt_at" = \$1 where "id" in \(\$2\)$/),
      'COMMIT;',
    ]);
  });

  it('sends no lock clause when claiming by compare-and-set', async () => {
    const store = new KnexOutboxStore(context(), { schema: 'messaging', claim: 'compare-and-set' });
    await store.append([event('evt-1')]);
    database.queries.length = 0;

    await store.claimBatch(10, now);

    expect(database.queries).toEqual([
      expect.stringMatching(/^select \* from "messaging"\."outbox" .* limit \$3$/),
      expect.stringMatching(/^update "messaging"\."outbox" set .* where "id" = \$2 and "status" = \$3 and "attempts" = \$4 and "next_attempt_at" <= \$5$/),
    ]);
  });

  it.each(['skip-locked', 'compare-and-set'] as const)(
    'shares the pending records between concurrent relays without overlap (%s)',
    async (claim) => {
      const relayA = new KnexOutboxStore(context(), { schema: 'messaging', claim });
      const relayB = new KnexOutboxStore(context(), { schema: 'messaging', claim });
      await relayA.append(Array.from({ length: 40 }, (_, index) => event(`evt-${index}`)));

      const batches = await Promise.all([
        relayA.claimBatch(10, now),
        relayB.claimBatch(10, now),
        relayA.claimBatch(10, now),
        relayB.claimBatch(10, now),
      ]);

      const ids = batches.flat().map((record) => record.event.id);
      expect(ids).toHaveLength(40);
      expect(new Set(ids).size).toBe(40);
      expect(await relayA.claimBatch(10, now)).toEqual([]);
    },
  );

  it('passes over the rows another connection holds instead of waiting for them', async (test) => {
    if (!database.real) {
      // PGlite is a single session: holding a lock on one connection while claiming on another
      // needs a real server (DDD_TS_KIT_TEST_DATABASE_URL).
      test.skip();
      return;
    }
    const store = new KnexOutboxStore(context(), { schema: 'messaging' });
    await store.append([event('evt-1'), event('evt-2'), event('evt-3')]);

    const claimed = await database.knex.transaction(async (holder) => {
      await holder('outbox').withSchema('messaging').whereIn('id', ['evt-1', 'evt-2']).forUpdate();
      return store.claimBatch(10, now);
    });

    expect(claimed.map((record) => record.event.id)).toEqual(['evt-3']);
    expect((await store.claimBatch(10, now)).map((record) => record.event.id)).toEqual(['evt-1', 'evt-2']);
  });

  it('stores timestamps as instants and gives them back as dates', async () => {
    const store = new KnexOutboxStore(context(), { schema: 'messaging', leaseMs: 1_000 });
    await store.append([event('evt-1')]);

    const [claimed] = await store.claimBatch(1, now);
    await store.markPublished(['evt-1'], now);
    const row: unknown = await database.knex('outbox').withSchema('messaging').first();

    expect(claimed?.nextAttemptAt).toEqual(new Date('2026-03-01T10:00:01.000Z'));
    expect(row).toMatchObject({ status: 'published', published_at: now, attempts: 1, sequence: '1' });
  });

  it('keeps a payload that is not an object as it was published', async () => {
    const store = new KnexOutboxStore(context(), { schema: 'messaging' });
    const payloads: unknown[] = ['plain text', [1, 'two', null], 42, null];
    await store.append(payloads.map((payload, index) => ({ ...event(`evt-${index}`), payload })));

    const claimed = await store.claimBatch(10, now);

    expect(claimed.map((record) => record.event.payload)).toEqual(payloads);
  });
});
