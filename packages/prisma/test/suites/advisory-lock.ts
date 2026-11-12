import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { advisoryLockContract } from '@ddd-ts-kit/testing/contracts';
import { advisoryLock, createPrismaUnitOfWork, tryAdvisoryLock } from '../../src';
import { createDatabase, type TestDatabase } from '../support/database';

const runner = { describe, it, expect, beforeEach, afterEach };

/** A real server hands each unit of work a connection of its own; PGlite is one session behind every socket. */
const REAL_SERVER = (process.env['DDD_TS_KIT_TEST_DATABASE_URL'] ?? '') !== '';

const HELD = `select count(*)::int as "held" from pg_locks where locktype = 'advisory' and pid = pg_backend_pid()`;

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase();
});

afterAll(async () => {
  await database.close();
});

advisoryLockContract(runner, {
  name: 'advisoryLock of @ddd-ts-kit/prisma',
  concurrent: REAL_SERVER,
  createLocks: () => {
    const unitOfWork = createPrismaUnitOfWork(database.prisma);

    return {
      run: (work) => unitOfWork.run(work),
      lock: (key, tenant) => advisoryLock(unitOfWork, key, tenant === undefined ? {} : { tenant }),
      tryLock: (key, tenant) => tryAdvisoryLock(unitOfWork, key, tenant === undefined ? {} : { tenant }),
      held: async () => {
        const rows = await unitOfWork.client().$queryRawUnsafe<{ held: number }[]>(HELD);

        return rows[0]?.held ?? 0;
      },
    };
  },
});
