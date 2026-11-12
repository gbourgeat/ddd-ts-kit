import { sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { advisoryLockContract } from '@ddd-ts-kit/testing/contracts';
import { advisoryLock, createDrizzleUnitOfWork, tryAdvisoryLock } from '../src/postgres';
import { createContractDatabase, type ContractDatabase } from './support/read-model/contract-database';

const runner = { describe, it, expect, beforeEach, afterEach };

/** A real server hands each unit of work a connection of its own; PGlite is one session behind every socket. */
const REAL_SERVER = (process.env['DDD_TS_KIT_TEST_DATABASE_URL'] ?? '') !== '';

const HELD = `select count(*)::int as "held" from pg_locks where locktype = 'advisory' and pid = pg_backend_pid()`;

let database: ContractDatabase;

beforeAll(async () => {
  database = await createContractDatabase([]);
});

afterAll(async () => {
  await database.close();
});

advisoryLockContract(runner, {
  name: 'advisoryLock of @ddd-ts-kit/drizzle',
  concurrent: REAL_SERVER,
  createLocks: () => {
    const unitOfWork = createDrizzleUnitOfWork(database.db);

    return {
      run: (work) => unitOfWork.run(work),
      lock: (key, tenant) => advisoryLock(unitOfWork, key, tenant === undefined ? {} : { tenant }),
      tryLock: (key, tenant) => tryAdvisoryLock(unitOfWork, key, tenant === undefined ? {} : { tenant }),
      held: async () => {
        const answered: unknown = await unitOfWork.executor().execute(sql.raw(HELD));
        const { rows } = answered as { rows: { held: number }[] };

        return rows[0]?.held ?? 0;
      },
    };
  },
});
