import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TransactionConflictError, type EventToAppend } from '@ddd-ts-kit/kernel';
import { createEventStoreTables, createKnexEventSourcing, createKnexUnitOfWork } from '../src';
import { createDatabase, type TestDatabase } from './support/database';

const REAL_SERVER = (process.env['DDD_TS_KIT_TEST_DATABASE_URL'] ?? '') !== '';

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase(
    async (db) => {
      await createEventStoreTables(db, { schema: 'scheduling' });
      await db.raw('create table "appointments" ("id" text primary key, "status" text not null)');
    },
    ['scheduling.stored_events', 'scheduling.stored_events_head', 'appointments'],
  );
});

afterAll(async () => {
  await database.close();
});

function booked(id: string): EventToAppend {
  return { id, type: 'scheduling.appointment.booked', schemaVersion: 1, data: { id }, occurredAt: new Date(0) };
}

/** A promise that resolves when `open` is called: what orders the steps of two concurrent units of work. */
function gate(): { readonly opened: Promise<void>; open(): void } {
  let open: () => void = () => undefined;

  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });

  return { opened, open: () => open() };
}

async function waitingForALock(): Promise<number> {
  const { rows } = await database.knex.raw<{ rows: { waiting: number }[] }>(
    `select count(*)::int as "waiting" from pg_stat_activity where "wait_event_type" = 'Lock'`,
  );

  return rows[0]?.waiting ?? 0;
}

describe('createKnexUnitOfWork: a deadlock is a conflict, whichever statement PostgreSQL gives up', () => {
  it.skipIf(!REAL_SERVER)(
    'rejects the unit of work whose row update closed the cycle with a TransactionConflictError',
    async () => {
      await database.truncate();
      await database.knex.raw(`insert into "appointments" values ('apt-1', 'booked')`);

      const here = createKnexUnitOfWork(database.knex);
      const there = createKnexUnitOfWork(database.knex);
      const store = (unitOfWork: typeof here) => createKnexEventSourcing(unitOfWork, { schema: 'scheduling' }).events;
      const appended = gate();
      const taken = gate();

      // First to wait, so first to look for the cycle: PostgreSQL gives up its update, not an append.
      const first = here.run(async () => {
        await store(here).append('appointment-1', 0, [booked('event-1')]);
        appended.open();
        await taken.opened;
        await here.executor().raw(`update "appointments" set "status" = 'cancelled' where "id" = 'apt-1'`);
      });

      const second = there.run(async () => {
        await appended.opened;
        await there.executor().raw(`update "appointments" set "status" = 'rescheduled' where "id" = 'apt-1'`);
        taken.open();
        await expect.poll(waitingForALock).toBe(1);
        await store(there).append('appointment-2', 0, [booked('event-2')]);
      });

      const [lost, won] = await Promise.allSettled([first, second]);

      expect(won.status).toBe('fulfilled');
      expect(lost).toMatchObject({ status: 'rejected', reason: expect.any(TransactionConflictError) });
      expect(lost.status === 'rejected' && lost.reason.cause).toMatchObject({ code: '40P01' });
    },
  );
});
