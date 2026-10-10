import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { outboxStoreContract, processedEventStoreContract } from '@ddd-ts-kit/testing/contracts';
import {
  DrizzleOutboxStore,
  DrizzleProcessedEventStore,
  createDrizzleUnitOfWork,
  outboxTable,
  processedEventsTable,
} from '../src/postgres.js';
import { createDatabase } from './support/database.js';

const runner = { describe, it, expect, beforeEach, afterEach };
const outbox = outboxTable('messaging');
const processed = processedEventsTable('messaging');
const defaultOutbox = outboxTable();
const defaultProcessed = processedEventsTable();

let database: Awaited<ReturnType<typeof createDatabase>>;

beforeAll(async () => {
  database = await createDatabase([outbox, processed, defaultOutbox, defaultProcessed]);
});

afterAll(async () => {
  await database.client.close();
});

const context = () => createDrizzleUnitOfWork(database.db);
const now = new Date('2026-03-01T10:00:00.000Z');

const event = (id: string): IntegrationEvent => ({
  id,
  type: 'billing.invoice.issued',
  version: 1,
  occurredAt: now.toISOString(),
  payload: { invoiceId: id },
});

outboxStoreContract(runner, {
  name: 'DrizzleOutboxStore in a schema of its own',
  leaseMs: 30_000,
  createStore: async () => {
    await database.truncate();

    return new DrizzleOutboxStore(context(), { table: outbox, leaseMs: 30_000 });
  },
});

outboxStoreContract(runner, {
  name: 'DrizzleOutboxStore in the public schema',
  leaseMs: 5_000,
  createStore: async () => {
    await database.truncate();

    return new DrizzleOutboxStore(context(), { leaseMs: 5_000 });
  },
});

processedEventStoreContract(runner, {
  name: 'DrizzleProcessedEventStore in a schema of its own',
  createStore: async () => {
    await database.truncate();

    return new DrizzleProcessedEventStore(context(), { table: processed });
  },
});

processedEventStoreContract(runner, {
  name: 'DrizzleProcessedEventStore in the public schema',
  createStore: async () => {
    await database.truncate();

    return new DrizzleProcessedEventStore(context());
  },
});

describe('table definitions', () => {
  it('place the tables in the given schema, or in public', () => {
    expect(getTableConfig(outbox)).toMatchObject({ schema: 'messaging', name: 'outbox' });
    expect(getTableConfig(processed)).toMatchObject({ schema: 'messaging', name: 'processed_events' });
    expect(getTableConfig(defaultOutbox).schema).toBeUndefined();
    expect(getTableConfig(defaultProcessed).schema).toBeUndefined();
  });

  it('index the pending records by next attempt, and only those', async () => {
    const { rows } = await database.db.execute<{ indexdef: string }>(
      sql`select indexdef from pg_indexes where schemaname = 'messaging' and indexname = 'outbox_pending_idx'`,
    );

    expect(rows[0]?.indexdef).toMatch(/\(next_attempt_at, sequence\) WHERE \(status = 'pending'/);
  });

  it('make (consumer, event_id) unique', async () => {
    const { rows } = await database.db.execute<{ indexdef: string }>(
      sql`select indexdef from pg_indexes where schemaname = 'messaging' and tablename = 'processed_events'`,
    );

    expect(rows.map((row) => row.indexdef)).toEqual([expect.stringMatching(/UNIQUE INDEX .* \(consumer, event_id\)/)]);
  });
});

describe('DrizzleOutboxStore.claimBatch', () => {
  beforeEach(async () => {
    await database.truncate();
  });

  it('locks the due rows with FOR UPDATE SKIP LOCKED inside one transaction', async () => {
    const store = new DrizzleOutboxStore(context(), { table: outbox });

    await store.append([event('evt-1')]);
    database.logger.queries.length = 0;

    await store.claimBatch(10, now);

    const [select, update] = database.logger.queries;

    expect(select).toMatch(
      /^select "id" from "messaging"\."outbox" where .*"status" = \$1 and .*"next_attempt_at" <= \$2.* order by .*"next_attempt_at", .*"sequence" limit \$3 for update skip locked$/,
    );

    expect(update).toMatch(/^update "messaging"\."outbox" set "attempts" = .* \+ 1, "next_attempt_at" = \$1/);
    expect(database.logger.queries).toHaveLength(2);
  });

  it('shares the pending records between relays without overlap', async () => {
    const relayA = new DrizzleOutboxStore(context(), { table: outbox });
    const relayB = new DrizzleOutboxStore(context(), { table: outbox });

    await relayA.append(Array.from({ length: 10 }, (_, index) => event(`evt-${index}`)));

    const batches = await Promise.all([
      relayA.claimBatch(4, now),
      relayB.claimBatch(4, now),
      relayA.claimBatch(4, now),
    ]);

    const ids = batches.flat().map((record) => record.event.id);

    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(10);
    expect(await relayA.claimBatch(4, now)).toEqual([]);
  });

  it('stores timestamps as instants and gives them back as dates', async () => {
    const store = new DrizzleOutboxStore(context(), { table: outbox, leaseMs: 1_000 });

    await store.append([event('evt-1')]);

    const [claimed] = await store.claimBatch(1, now);

    await store.markPublished(['evt-1'], now);
    const [row] = await database.db.select().from(outbox);

    expect(claimed?.nextAttemptAt).toEqual(new Date('2026-03-01T10:00:01.000Z'));
    expect(row).toMatchObject({ status: 'published', publishedAt: now, attempts: 1, sequence: 1 });
  });
});
