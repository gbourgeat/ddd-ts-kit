import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { In } from 'typeorm';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { outboxStoreContract, processedEventStoreContract } from '@ddd-ts-kit/testing/contracts';
import {
  TypeOrmOutboxStore,
  TypeOrmProcessedEventStore,
  createTypeOrmUnitOfWork,
  outboxEntity,
  processedEventEntity,
} from '../src/index.js';
import { createDatabase, type TestDatabase } from './support/database.js';

const runner = { describe, it, expect, beforeEach, afterEach };
const outbox = outboxEntity({ schema: 'messaging' });
const processed = processedEventEntity({ schema: 'messaging' });

let database: TestDatabase;
beforeAll(async () => {
  database = await createDatabase([outbox, processed, outboxEntity(), processedEventEntity()]);
});
afterAll(async () => {
  await database.close();
});

const context = () => createTypeOrmUnitOfWork(database.dataSource);
const now = new Date('2026-03-01T10:00:00.000Z');
const event = (id: string): IntegrationEvent => ({
  id,
  type: 'billing.invoice.issued',
  version: 1,
  occurredAt: now.toISOString(),
  payload: { invoiceId: id },
});

outboxStoreContract(runner, {
  name: 'TypeOrmOutboxStore in a schema of its own',
  leaseMs: 30_000,
  createStore: async () => {
    await database.truncate();
    return new TypeOrmOutboxStore(context(), { entity: outbox, leaseMs: 30_000 });
  },
});

outboxStoreContract(runner, {
  name: 'TypeOrmOutboxStore in the default schema',
  leaseMs: 5_000,
  createStore: async () => {
    await database.truncate();
    return new TypeOrmOutboxStore(context(), { leaseMs: 5_000 });
  },
});

outboxStoreContract(runner, {
  name: 'TypeOrmOutboxStore claiming by compare-and-set',
  leaseMs: 30_000,
  createStore: async () => {
    await database.truncate();
    return new TypeOrmOutboxStore(context(), { entity: outbox, claim: 'compare-and-set' });
  },
});

processedEventStoreContract(runner, {
  name: 'TypeOrmProcessedEventStore in a schema of its own',
  createStore: async () => {
    await database.truncate();
    return new TypeOrmProcessedEventStore(context(), { entity: processed });
  },
});

processedEventStoreContract(runner, {
  name: 'TypeOrmProcessedEventStore in the default schema',
  createStore: async () => {
    await database.truncate();
    return new TypeOrmProcessedEventStore(context());
  },
});

describe('entity schemas', () => {
  const indexes = async (table: string): Promise<string[]> => {
    const rows = await database.dataSource.query<{ indexdef: string }[]>(
      "select indexdef from pg_indexes where schemaname = 'messaging' and tablename = $1 order by indexname",
      [table],
    );
    return rows.map((row) => row.indexdef);
  };

  it('place the tables in the given schema, or in the default one', () => {
    const pathOf = (entity: Parameters<typeof database.dataSource.getMetadata>[0]) =>
      database.dataSource.getMetadata(entity).tablePath;

    expect(pathOf(outbox)).toBe('messaging.outbox');
    expect(pathOf(processed)).toBe('messaging.processed_events');
    expect(pathOf(outboxEntity())).toBe('outbox');
    expect(pathOf(processedEventEntity())).toBe('processed_events');
  });

  it('give each schema an entity of its own, so two contexts fit in one data source', () => {
    expect(outbox.options.name).toBe('OutboxRecord_messaging');
    expect(outboxEntity().options.name).toBe('OutboxRecord');
    expect(outboxEntity({ schema: 'billing', name: 'BillingOutbox' }).options.name).toBe('BillingOutbox');
    expect(processed.options.name).toBe('ProcessedEvent_messaging');
  });

  it('index the pending records by next attempt, and only those', async () => {
    expect(await indexes('outbox')).toContainEqual(
      expect.stringMatching(/outbox_pending_idx .*\(next_attempt_at, sequence\) WHERE .*status.* = 'pending'/),
    );
  });

  it('make (consumer, event_id) unique', async () => {
    expect(await indexes('processed_events')).toEqual([
      expect.stringMatching(/UNIQUE INDEX .* \(consumer, event_id\)/),
    ]);
  });

  it('pick the column types of the dialect', () => {
    const types = (dialect: 'postgres' | 'mysql' | 'sqlite') => {
      const { columns } = outboxEntity({ dialect }).options;
      return [columns.payload?.type, columns.nextAttemptAt?.type, columns.id?.primary, columns.sequence?.primary];
    };

    expect(types('postgres')).toEqual(['jsonb', 'timestamp with time zone', true, undefined]);
    expect(types('mysql')).toEqual(['json', 'datetime', true, undefined]);
    expect(types('sqlite')).toEqual(['simple-json', 'datetime', undefined, true]);
  });
});

describe('TypeOrmOutboxStore.claimBatch', () => {
  beforeEach(async () => {
    await database.truncate();
  });

  it('locks the due rows with FOR UPDATE SKIP LOCKED inside one transaction', async () => {
    const store = new TypeOrmOutboxStore(context(), { entity: outbox });
    await store.append([event('evt-1')]);
    database.queries.length = 0;

    await store.claimBatch(10, now);

    expect(database.queries).toEqual([
      'START TRANSACTION',
      expect.stringMatching(
        /^SELECT .* FROM "messaging"\."outbox" "outbox" WHERE "outbox"\."status" = \$1 AND "outbox"\."next_attempt_at" <= \$2 ORDER BY "outbox"\."next_attempt_at" ASC, "outbox"\."sequence" ASC LIMIT 10 FOR UPDATE SKIP LOCKED$/,
      ),
      expect.stringMatching(/^UPDATE "messaging"\."outbox" SET "attempts" = "attempts" \+ 1, "next_attempt_at" = \$1 WHERE "id" IN \(\$2\)$/),
      'COMMIT',
    ]);
  });

  it('sends no lock clause when claiming by compare-and-set', async () => {
    const store = new TypeOrmOutboxStore(context(), { entity: outbox, claim: 'compare-and-set' });
    await store.append([event('evt-1')]);
    database.queries.length = 0;

    await store.claimBatch(10, now);

    expect(database.queries).toEqual([
      expect.stringMatching(/^SELECT .* FROM "messaging"\."outbox" .* LIMIT 10$/),
      expect.stringMatching(
        /^UPDATE "messaging"\."outbox" SET .* WHERE \(?"id" = \$2 AND "status" = \$3 AND "attempts" = \$4 AND "next_attempt_at" <= \$5\)?$/,
      ),
    ]);
  });

  it.each(['skip-locked', 'compare-and-set'] as const)(
    'shares the pending records between concurrent relays without overlap (%s)',
    async (claim) => {
      const relayA = new TypeOrmOutboxStore(context(), { entity: outbox, claim });
      const relayB = new TypeOrmOutboxStore(context(), { entity: outbox, claim });
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
    const store = new TypeOrmOutboxStore(context(), { entity: outbox });
    await store.append([event('evt-1'), event('evt-2'), event('evt-3')]);

    const claimed = await database.dataSource.transaction(async (holder) => {
      await holder
        .createQueryBuilder(outbox, 'held')
        .where({ id: In(['evt-1', 'evt-2']) })
        .setLock('pessimistic_write')
        .getMany();
      return store.claimBatch(10, now);
    });

    expect(claimed.map((record) => record.event.id)).toEqual(['evt-3']);
    expect((await store.claimBatch(10, now)).map((record) => record.event.id)).toEqual(['evt-1', 'evt-2']);
  });

  it('stores timestamps as instants and gives them back as dates', async () => {
    const store = new TypeOrmOutboxStore(context(), { entity: outbox, leaseMs: 1_000 });
    await store.append([event('evt-1')]);

    const [claimed] = await store.claimBatch(1, now);
    await store.markPublished(['evt-1'], now);
    const row = await database.dataSource.manager.findOneBy(outbox, { id: 'evt-1' });

    expect(claimed?.nextAttemptAt).toEqual(new Date('2026-03-01T10:00:01.000Z'));
    expect(row).toMatchObject({ status: 'published', publishedAt: now, attempts: 1, sequence: '1' });
  });

  it('keeps a payload that is not an object as it was published', async () => {
    const store = new TypeOrmOutboxStore(context(), { entity: outbox });
    const payloads: unknown[] = ['plain text', [1, 'two', null], 42, null];
    await store.append(payloads.map((payload, index) => ({ ...event(`evt-${index}`), payload })));

    const claimed = await store.claimBatch(10, now);

    expect(claimed.map((record) => record.event.payload)).toEqual(payloads);
  });
});
