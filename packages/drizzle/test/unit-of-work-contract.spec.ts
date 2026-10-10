import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { unitOfWorkContract } from '@ddd-ts-kit/testing/contracts';
import { DrizzleOutboxStore, createDrizzleUnitOfWork, outboxTable } from '../src/postgres.js';
import { createDatabase } from './support/database.js';

const runner = { describe, it, expect, beforeEach, afterEach };
const outbox = outboxTable();

/** One id under a primary key, and a reference the database checks at commit only. */
const PARCELS = `create table contract_parcels (
  id text primary key,
  sealed_by text references contract_parcels (id) deferrable initially deferred
)`;

let database: Awaited<ReturnType<typeof createDatabase>>;

beforeAll(async () => {
  database = await createDatabase([outbox]);
  await database.client.exec(PARCELS);
});

afterAll(async () => {
  await database.client.close();
});

// PGlite is one session: no second connection to read from, so `committedIds` is left out.
unitOfWorkContract(runner, {
  name: 'createDrizzleUnitOfWork on PGlite',
  createUnitOfWork: async () => {
    await database.truncate();
    await database.client.exec('truncate table contract_parcels');

    const unitOfWork = createDrizzleUnitOfWork(database.db);

    return {
      unitOfWork,
      outbox: new DrizzleOutboxStore(unitOfWork, { table: outbox }),
      insert: async (id) =>
        void (await unitOfWork.executor().execute(sql`insert into contract_parcels (id) values (${id})`)),
      insertRefusedAtCommit: async (id) =>
        void (await unitOfWork
          .executor()
          .execute(sql`insert into contract_parcels (id, sealed_by) values (${id}, 'nobody')`)),
      ids: async () => {
        const { rows } = await unitOfWork
          .executor()
          .execute<{ id: string }>(sql`select id from contract_parcels order by id`);

        return rows.map((row) => row.id);
      },
    };
  },
});
