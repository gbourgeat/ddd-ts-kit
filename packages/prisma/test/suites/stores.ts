import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { outboxStoreContract, processedEventStoreContract } from '@ddd-ts-kit/testing/contracts';
import {
  PrismaOutboxStore,
  PrismaProcessedEventStore,
  createPrismaUnitOfWork,
  type PrismaOutboxClaim,
} from '../../src';
import type { Prisma } from '../generated/client/client';
import { createDatabase, type TestDatabase } from '../support/database';

const runner = { describe, it, expect, beforeEach, afterEach };

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase();
});

afterAll(async () => {
  await database.close();
});

const unitOfWork = () => createPrismaUnitOfWork(database.prisma);
const now = new Date('2026-03-01T10:00:00.000Z');

const event = (id: string): IntegrationEvent => ({
  id,
  type: 'billing.invoice.issued',
  version: 1,
  occurredAt: now.toISOString(),
  payload: { invoiceId: id },
});

type Claim = PrismaOutboxClaim<Prisma.TransactionClient>;

const skipLocked: Claim = {
  strategy: 'skip-locked',
  dialect: 'postgresql',
  schema: 'messaging',
  raw: (client) => client,
};

/** The outbox of the `messaging` schema: the renamed copy of the shipped model, its tenant field uncommented. */
const messagingOutbox = (claim: Claim, leaseMs = 30_000) =>
  new PrismaOutboxStore(unitOfWork(), {
    delegate: (client) => client.messagingOutboxRecord,
    claim,
    leaseMs,
  });

/** The same outbox, told to keep the tenant of each event. */
const tenantedOutbox = () =>
  new PrismaOutboxStore(unitOfWork(), {
    delegate: (client) => client.messagingOutboxRecord,
    claim: skipLocked,
    tenant: true,
  });

outboxStoreContract(runner, {
  name: 'PrismaOutboxStore in a schema of its own, claiming with skip locked',
  leaseMs: 30_000,
  createStore: async () => {
    await database.truncate();

    return messagingOutbox(skipLocked);
  },
});

outboxStoreContract(runner, {
  name: 'PrismaOutboxStore in the default schema, claiming with skip locked',
  leaseMs: 5_000,
  createStore: async () => {
    await database.truncate();

    return new PrismaOutboxStore(unitOfWork(), {
      delegate: (client) => client.outboxRecord,
      claim: { strategy: 'skip-locked', dialect: 'postgresql', raw: (client) => client },
      leaseMs: 5_000,
    });
  },
});

outboxStoreContract(runner, {
  name: 'PrismaOutboxStore claiming by compare-and-set',
  leaseMs: 30_000,
  createStore: async () => {
    await database.truncate();

    return messagingOutbox('compare-and-set');
  },
});

outboxStoreContract(runner, {
  name: 'PrismaOutboxStore keeping the tenant of each event',
  leaseMs: 30_000,
  carriesTenant: true,
  createStore: async () => {
    await database.truncate();

    return tenantedOutbox();
  },
});

processedEventStoreContract(runner, {
  name: 'PrismaProcessedEventStore in a schema of its own',
  createStore: async () => {
    await database.truncate();

    return new PrismaProcessedEventStore(unitOfWork(), {
      delegate: (client) => client.messagingProcessedEvent,
    });
  },
});

processedEventStoreContract(runner, {
  name: 'PrismaProcessedEventStore in the default schema',
  createStore: async () => {
    await database.truncate();

    return new PrismaProcessedEventStore(unitOfWork(), { delegate: (client) => client.processedEvent });
  },
});

describe('the shipped schema fragment', () => {
  const indexes = async (table: string): Promise<string[]> => {
    const rows = await database.prisma.$queryRaw<{ indexdef: string }[]>`
      select indexdef from pg_indexes
      where schemaname = 'messaging' and tablename = ${table} order by indexname`;

    return rows.map((row) => row.indexdef);
  };

  it('places the tables in the schema of the model, or in the default one', async () => {
    const tables = await database.prisma.$queryRaw<{ name: string }[]>`
      select schemaname || '.' || tablename as name from pg_tables
      where tablename in ('outbox', 'processed_events') order by 1`;

    expect(tables.map((table) => table.name)).toEqual([
      'messaging.outbox',
      'messaging.processed_events',
      'public.outbox',
      'public.processed_events',
    ]);
  });

  it('indexes the records by status and next attempt for the relay', async () => {
    expect(await indexes('outbox')).toContainEqual(expect.stringMatching(/\(status, next_attempt_at, sequence\)$/));
  });

  it('makes (consumer, event_id) unique', async () => {
    expect(await indexes('processed_events')).toEqual([
      expect.stringMatching(/UNIQUE INDEX .* \(consumer, event_id\)/),
    ]);
  });
});

describe('PrismaOutboxStore.claimBatch', () => {
  beforeEach(async () => {
    await database.truncate();
  });

  it('locks the due rows with FOR UPDATE SKIP LOCKED inside one transaction', async () => {
    const store = messagingOutbox(skipLocked);

    await store.append([event('evt-1')]);
    database.queries.length = 0;

    await store.claimBatch(10, now);

    // Prisma logs the end of an interactive transaction, not its BEGIN.
    expect(database.queries).toEqual([
      'select "id" from "messaging"."outbox" where "status" = $1 and "next_attempt_at" <= $2 order by "next_attempt_at", "sequence" limit $3 for update skip locked',
      expect.stringMatching(/^SELECT .* FROM "messaging"\."outbox" WHERE "messaging"\."outbox"\."id" IN \(\$1\)/),
      expect.stringMatching(
        /^UPDATE "messaging"\."outbox" SET "attempts" = \("messaging"\."outbox"\."attempts" \+ \$1\), "next_attempt_at" = \$2 WHERE .*"id" IN \(\$3\)/,
      ),
      'COMMIT',
    ]);
  });

  it('sends plain Prisma Client queries, and no lock clause, when claiming by compare-and-set', async () => {
    const store = messagingOutbox('compare-and-set');

    await store.append([event('evt-1')]);
    database.queries.length = 0;

    await store.claimBatch(10, now);

    expect(database.queries).toEqual([
      expect.stringMatching(
        /^SELECT .* FROM "messaging"\."outbox" WHERE .* ORDER BY .*"next_attempt_at" ASC, .*"sequence" ASC LIMIT \$3/,
      ),
      expect.stringMatching(
        /^UPDATE "messaging"\."outbox" SET .* WHERE \(.*"id" = \$3 AND .*"status" = \$4 AND .*"attempts" = \$5 AND .*"next_attempt_at" <= \$6\)/,
      ),
    ]);
  });

  it('refuses a table or schema name that is not a plain identifier, since the select is raw SQL', () => {
    const withTable = (table: string) => () => messagingOutbox({ ...skipLocked, table });

    expect(withTable('outbox"; drop table x; --')).toThrow(TypeError);
    expect(withTable('outbox_v2')).not.toThrow();
  });
});

describe('PrismaOutboxStore.claimBatch between relays', () => {
  beforeEach(async () => {
    await database.truncate();
  });

  it.each(['skip-locked', 'compare-and-set'] as const)(
    'shares the pending records between concurrent relays without overlap (%s)',
    async (strategy) => {
      const claim = strategy === 'skip-locked' ? skipLocked : strategy;
      const relayA = messagingOutbox(claim);
      const relayB = messagingOutbox(claim);

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

    const store = messagingOutbox(skipLocked);

    await store.append([event('evt-1'), event('evt-2'), event('evt-3')]);

    const claimed = await database.prisma.$transaction(async (holder) => {
      await holder.$queryRaw`select id from messaging.outbox where id in ('evt-1', 'evt-2') for update`;

      return store.claimBatch(10, now);
    });

    expect(claimed.map((record) => record.event.id)).toEqual(['evt-3']);
    expect((await store.claimBatch(10, now)).map((record) => record.event.id)).toEqual(['evt-1', 'evt-2']);
  });

  it('joins the unit of work it is called in instead of opening a transaction', async () => {
    const work = unitOfWork();

    const store = new PrismaOutboxStore(work, {
      delegate: (client) => client.messagingOutboxRecord,
      claim: skipLocked,
    });

    await store.append([event('evt-1')]);
    database.queries.length = 0;

    const claimed = await work.run(() => store.claimBatch(10, now));

    expect(claimed.map((record) => record.event.id)).toEqual(['evt-1']);
    expect(database.queries.filter((query) => query === 'COMMIT')).toHaveLength(1);
    expect(database.queries.at(-1)).toBe('COMMIT');
  });
});

describe('PrismaOutboxStore with nothing to do', () => {
  beforeEach(async () => {
    await database.truncate();
  });

  it('sends no query for an empty batch, nor for a claim of nothing', async () => {
    const store = messagingOutbox(skipLocked);

    await store.append([event('evt-1')]);
    database.queries.length = 0;

    await store.append([]);
    const claimed = await store.claimBatch(0, now);

    await store.markPublished([], now);
    const revived = await store.retryDead([], now);

    expect([claimed, revived]).toEqual([[], 0]);
    expect(database.queries).toEqual([]);
    expect(await store.stats()).toEqual({ pending: 1, failed: 0, dead: 0 });
  });
});

describe('PrismaOutboxStore: what a record keeps', () => {
  beforeEach(async () => {
    await database.truncate();
  });

  it('stores timestamps as instants and gives them back as dates', async () => {
    const store = messagingOutbox(skipLocked, 1_000);

    await store.append([event('evt-1')]);

    const [claimed] = await store.claimBatch(1, now);

    await store.markPublished(['evt-1'], now);
    const row = await database.prisma.messagingOutboxRecord.findUnique({ where: { id: 'evt-1' } });

    expect(claimed?.nextAttemptAt).toEqual(new Date('2026-03-01T10:00:01.000Z'));
    expect(row).toMatchObject({ status: 'published', publishedAt: now, attempts: 1, sequence: 1n });
  });

  it('writes no tenant unless told to, and gives back the one a row has', async () => {
    const untold = messagingOutbox(skipLocked);

    await untold.append([{ ...event('evt-1'), tenantId: 'acme' }]);
    await tenantedOutbox().append([{ ...event('evt-2'), tenantId: 'acme' }, event('evt-3')]);

    const rows = await database.prisma.messagingOutboxRecord.findMany({ orderBy: { sequence: 'asc' } });
    const claimed = await untold.claimBatch(10, now);

    expect(rows.map((row) => row.tenantId)).toEqual([null, 'acme', null]);
    expect(claimed.map((record) => record.event.tenantId)).toEqual([undefined, 'acme', undefined]);
  });

  it('keeps a payload that is not an object as it was published', async () => {
    const store = messagingOutbox(skipLocked);
    const payloads: unknown[] = ['plain text', [1, 'two', null], 42, null];

    await store.append(payloads.map((payload, index) => ({ ...event(`evt-${index}`), payload })));

    const claimed = await store.claimBatch(10, now);

    expect(claimed.map((record) => record.event.payload)).toEqual(payloads);
  });
});
