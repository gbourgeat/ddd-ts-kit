import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { unitOfWorkContract } from '@ddd-ts-kit/testing/contracts';
import { PrismaOutboxStore, createPrismaUnitOfWork } from '../../src';
import { createDatabase, type TestDatabase } from '../support/database';

const runner = { describe, it, expect, beforeEach, afterEach };

/** One id under a primary key, and a reference the database checks at commit only. */
const PARCELS = `create table contract_parcels (
  id text primary key,
  sealed_by text references contract_parcels (id) deferrable initially deferred
)`;

const SELECT = 'select id from contract_parcels order by id';

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase();
  await database.prisma.$executeRawUnsafe(PARCELS);
});

afterAll(async () => {
  await database.close();
});

const idsOf = (rows: { id: string }[]): string[] => rows.map((row) => row.id);

unitOfWorkContract(runner, {
  name: 'createPrismaUnitOfWork on PostgreSQL',
  createUnitOfWork: async () => {
    await database.truncate();
    await database.prisma.$executeRawUnsafe('truncate table contract_parcels');

    const unitOfWork = createPrismaUnitOfWork(database.prisma);

    return {
      unitOfWork,
      outbox: new PrismaOutboxStore(unitOfWork, {
        delegate: (client) => client.outboxRecord,
        claim: { strategy: 'skip-locked', dialect: 'postgresql', raw: (client) => client },
      }),
      insert: async (id) =>
        void (await unitOfWork.client().$executeRawUnsafe('insert into contract_parcels (id) values ($1)', id)),
      insertRefusedAtCommit: async (id) =>
        void (await unitOfWork
          .client()
          .$executeRawUnsafe("insert into contract_parcels (id, sealed_by) values ($1, 'nobody')", id)),
      ids: async () => idsOf(await unitOfWork.client().$queryRawUnsafe<{ id: string }[]>(SELECT)),
      // A real server hands the pool another connection; PGlite is one session behind every socket.
      ...(database.real
        ? { committedIds: async () => idsOf(await database.prisma.$queryRawUnsafe<{ id: string }[]>(SELECT)) }
        : {}),
    };
  },
});
