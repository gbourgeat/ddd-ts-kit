import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Criteria, offsetPage, scoped } from '@ddd-ts-kit/kernel';
import { storableStamp } from '../../../../shared-kernel/storable-stamp.js';
import { openTestDatabase, type TestDatabase } from '../../../../platform/database/open-test-database.js';
import type { Occupancy, OccupancyRegister } from '../../application/ports/occupancy-register.port.js';
import { ANALYTICS_SCHEMA } from '../../infrastructure/persistence/analytics.schema.js';
import { createAnalyticsTables } from '../../infrastructure/persistence/create-analytics-tables.schema.js';
import { KnexOccupancyRegister } from '../../infrastructure/persistence/knex-occupancy-register.repository.js';
import { anOccupancy } from '../builders/occupancy.builder.js';
import { FakeOccupancyRegister } from '../fakes/occupancy-register.fake.js';

let database: TestDatabase;

beforeAll(async () => {
  database = await openTestDatabase();

  const knex = database.persistence.database.executor();

  if (!(await knex.schema.withSchema(ANALYTICS_SCHEMA).hasTable('occupancy'))) await createAnalyticsTables(knex);
});

afterAll(async () => {
  await database.close();
});

const ADAPTERS: readonly (readonly [string, () => Promise<OccupancyRegister>])[] = [
  ['the fake', async () => new FakeOccupancyRegister()],
  [
    'the knex adapter',
    async () => {
      await database.reset();

      return new KnexOccupancyRegister(database.persistence.database);
    },
  ],
];

const LINES: readonly Occupancy[] = [
  anOccupancy({ calendarId: 'calendar-1', day: '2026-10-12', heldMinutes: 30 }),
  anOccupancy({ calendarId: 'calendar-1', day: '2026-10-13', heldMinutes: 90 }),
  anOccupancy({ calendarId: 'calendar-2', day: '2026-10-13', heldMinutes: 60 }),
  anOccupancy({ calendarId: 'calendar-2', day: '2026-10-14', heldMinutes: 15 }),
  anOccupancy({ calendarId: 'calendar-3', day: '2026-10-13', practiceId: 'practice-2' }),
];

const stamp = { eventId: 'fact-1', occurredAt: new Date('2026-10-01T10:00:00.000Z') };
const ofThePractice = Criteria.of<Occupancy>().where('practiceId', 'eq', 'practice-1');

describe.each(ADAPTERS)('OccupancyRegister, %s', (_name, create) => {
  it('answers a line as it was written, every figure of it', async () => {
    const occupancy = await create();
    const line = anOccupancy({ heldMinutes: 135, appointmentsHeld: 4, completed: 2, noShows: 1, cancelledByPatient: 3, cancelledByPractice: 5 });

    await occupancy.upsertIfNewer(line.id, stamp, () => line);

    expect(await occupancy.get('calendar-1.2026-10-12')).toEqual(line);
  });

  it('lists the lines of a practice by day, then by calendar, with their total', async () => {
    const occupancy = await written(await create());

    const page = await occupancy.list(scoped(ofThePractice.page(offsetPage({ limit: 3 })), { kind: 'all' }));

    expect(page.items.map((line) => line.id)).toEqual(['calendar-1.2026-10-12', 'calendar-1.2026-10-13', 'calendar-2.2026-10-13']);
    expect(page.total).toBe(4);
  });

  it('keeps the days of a range, both ends included, latest first when asked', async () => {
    const occupancy = await written(await create());

    const page = await occupancy.list(scoped(ofThePractice.where('day', 'between', ['2026-10-13', '2026-10-14']).orderBy('day', 'desc'), { kind: 'all' }));

    expect(page.items.map((line) => line.id)).toEqual(['calendar-2.2026-10-14', 'calendar-2.2026-10-13', 'calendar-1.2026-10-13']);
  });

  it('narrows the list to the calendars the actor measures', async () => {
    const occupancy = await written(await create());

    const page = await occupancy.list(scoped(ofThePractice, { kind: 'ids', ids: ['calendar-2'] }, { ids: 'calendarId' }));

    expect(page.items.map((line) => line.calendarId)).toEqual(['calendar-2', 'calendar-2']);
  });

  it('orders the lines by the time held', async () => {
    const occupancy = await written(await create());

    const page = await occupancy.list(scoped(ofThePractice.orderBy('heldMinutes', 'desc'), { kind: 'all' }));

    expect(page.items.map((line) => line.heldMinutes)).toEqual([90, 60, 30, 15]);
  });

  // The stamps of real facts carry milliseconds, which the SQL store reads back to the second: the projections stamp with `storableStamp`.
  it('follows the facts of a calendar and day milliseconds apart, as the projection stamps them', async () => {
    const occupancy = await create();
    const line = anOccupancy({ heldMinutes: 30 });

    const writes = [
      await occupancy.upsertIfNewer(line.id, storableStamp(precise('fact-1', 123)), () => line),
      await occupancy.upsertIfNewer(line.id, storableStamp(precise('fact-2', 456)), () => ({ ...line, heldMinutes: 60 })),
      await occupancy.upsertIfNewer(line.id, storableStamp(precise('fact-1', 123)), () => line),
    ];

    expect(writes).toEqual(['applied', 'applied', 'stale']);
    expect(await occupancy.get(line.id)).toMatchObject({ heldMinutes: 60 });
  });
});

async function written(occupancy: OccupancyRegister): Promise<OccupancyRegister> {
  for (const line of LINES) await occupancy.upsertIfNewer(line.id, stamp, () => line);

  return occupancy;
}

function precise(eventId: string, millisecond: number) {
  return { eventId, occurredAt: new Date(Date.UTC(2026, 9, 1, 10, 0, 0, millisecond)) };
}
