import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { unitOfWorkContract } from '@ddd-ts-kit/testing/contracts';
import { TypeOrmOutboxStore, createTypeOrmUnitOfWork, outboxEntity } from '../src/index.js';
import { createDatabase, type TestDatabase } from './support/database.js';

const runner = { describe, it, expect, beforeEach, afterEach };
const outbox = outboxEntity();

/** One id under a primary key, and a reference the database checks at commit only. */
const PARCELS = `create table contract_parcels (
  id text primary key,
  sealed_by text references contract_parcels (id) deferrable initially deferred
)`;

const SELECT = 'select id from contract_parcels order by id';

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase([outbox]);
  await database.dataSource.query(PARCELS);
});

afterAll(async () => {
  await database.close();
});

const idsOf = (rows: { id: string }[]): string[] => rows.map((row) => row.id);

unitOfWorkContract(runner, {
  name: 'createTypeOrmUnitOfWork on PostgreSQL',
  createUnitOfWork: async () => {
    await database.truncate();
    await database.dataSource.query('truncate table contract_parcels');

    const unitOfWork = createTypeOrmUnitOfWork(database.dataSource);

    return {
      unitOfWork,
      outbox: new TypeOrmOutboxStore(unitOfWork, { entity: outbox }),
      insert: async (id) => void (await unitOfWork.manager().query('insert into contract_parcels (id) values ($1)', [id])),
      insertRefusedAtCommit: async (id) =>
        void (await unitOfWork.manager().query("insert into contract_parcels (id, sealed_by) values ($1, 'nobody')", [id])),
      ids: async () => idsOf(await unitOfWork.manager().query(SELECT)),
      // A real server hands the pool another connection; PGlite is one session behind every socket.
      ...(database.real ? { committedIds: async () => idsOf(await database.dataSource.query(SELECT)) } : {}),
    };
  },
});
