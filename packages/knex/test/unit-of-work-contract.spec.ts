import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { unitOfWorkContract } from '@ddd-ts-kit/testing/contracts';
import { KnexOutboxStore, createKnexUnitOfWork, createOutboxTables } from '../src/index.js';
import { createDatabase, type TestDatabase } from './support/database.js';

const runner = { describe, it, expect, beforeEach, afterEach };

/** One id under a primary key, and a reference the database checks at commit only. */
const PARCELS = `create table contract_parcels (
  id text primary key,
  sealed_by text references contract_parcels (id) deferrable initially deferred
)`;

const SELECT = 'select id from contract_parcels order by id';

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase(
    async (knex) => {
      await createOutboxTables(knex);
      await knex.raw(PARCELS);
    },
    ['outbox', 'processed_events', 'contract_parcels'],
  );
});

afterAll(async () => {
  await database.close();
});

const idsOf = (result: { rows: { id: string }[] }): string[] => result.rows.map((row) => row.id);

unitOfWorkContract(runner, {
  name: 'createKnexUnitOfWork on PostgreSQL',
  createUnitOfWork: async () => {
    await database.truncate();

    const unitOfWork = createKnexUnitOfWork(database.knex);

    return {
      unitOfWork,
      outbox: new KnexOutboxStore(unitOfWork),
      insert: async (id) => void (await unitOfWork.executor().raw('insert into contract_parcels (id) values (?)', [id])),
      insertRefusedAtCommit: async (id) =>
        void (await unitOfWork.executor().raw("insert into contract_parcels (id, sealed_by) values (?, 'nobody')", [id])),
      ids: async () => idsOf(await unitOfWork.executor().raw(SELECT)),
      // A real server hands the pool another connection; PGlite is one session behind every socket.
      ...(database.real ? { committedIds: async () => idsOf(await database.knex.raw(SELECT)) } : {}),
    };
  },
});
