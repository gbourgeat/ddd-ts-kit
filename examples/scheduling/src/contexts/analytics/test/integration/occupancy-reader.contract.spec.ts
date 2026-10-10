import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Criteria, cursorPage, offsetPage, scoped, type ReadScope } from '@ddd-ts-kit/kernel';
import { openTestDatabase, type TestDatabase } from '#src/platform/database/open-test-database.js';
import type { Occupancy, OccupancyReader } from '#src/contexts/analytics/application/ports/occupancy-reader.port.js';
import type { Outcome, OutcomeRegister } from '#src/contexts/analytics/application/ports/outcome-register.port.js';
import { ANALYTICS_SCHEMA } from '#src/contexts/analytics/infrastructure/persistence/analytics.schema.js';
import { createAnalyticsTables } from '#src/contexts/analytics/infrastructure/persistence/create-analytics-tables.schema.js';
import { KnexOccupancyReader } from '#src/contexts/analytics/infrastructure/persistence/knex-occupancy-reader.repository.js';
import { KnexOutcomeRegister } from '#src/contexts/analytics/infrastructure/persistence/knex-outcome-register.repository.js';
import { anOccupancy } from '#src/contexts/analytics/test/builders/occupancy.builder.js';
import { anOutcome } from '#src/contexts/analytics/test/builders/outcome.builder.js';
import { FakeOccupancyReader } from '#src/contexts/analytics/test/fakes/occupancy-reader.fake.js';
import { FakeOutcomeRegister } from '#src/contexts/analytics/test/fakes/outcome-register.fake.js';

/** The outcomes a reader measures, and the reader: the fake and the adapter are given the same ones, the same way. */
type Measured = {
  readonly outcomes: OutcomeRegister;
  readonly occupancy: OccupancyReader;
};

let database: TestDatabase;

beforeAll(async () => {
  database = await openTestDatabase(process.env['DATABASE_URL'] === '' ? undefined : process.env['DATABASE_URL']);

  const knex = database.persistence.database.executor();

  if (!(await knex.schema.withSchema(ANALYTICS_SCHEMA).hasTable('outcomes'))) {
    await createAnalyticsTables(knex);
  }
});

afterAll(async () => {
  await database.close();
});

const ADAPTERS: readonly (readonly [string, () => Promise<Measured>])[] = [
  ['the fake', async () => measuredBy(new FakeOutcomeRegister(), (outcomes) => new FakeOccupancyReader(outcomes))],
  [
    'the knex adapter',
    async () => {
      await database.reset();

      return measuredBy(
        new KnexOutcomeRegister(database.persistence.database),
        () => new KnexOccupancyReader(database.persistence.database),
      );
    },
  ],
];

const monday = { calendarId: 'calendar-1', day: '2026-10-12' };
const tuesday = { calendarId: 'calendar-1', day: '2026-10-13' };
const elsewhereOnTuesday = { calendarId: 'calendar-2', day: '2026-10-13' };
const wednesday = { calendarId: 'calendar-2', day: '2026-10-14' };
const thursday = { calendarId: 'calendar-2', day: '2026-10-15' };
const friday = { calendarId: 'calendar-2', day: '2026-10-16' };

/** What scheduling announced, appointment by appointment: the time each one takes is in seconds. */
const OUTCOMES: readonly Outcome[] = [
  anAppointment('appointment-01', { ...monday, state: 'held' }, 30 * 60),
  anAppointment('appointment-02', { ...monday, state: 'completed' }, 45 * 60),
  anAppointment('appointment-03', { ...monday, state: 'no-show' }, 15 * 60),
  anAppointment('appointment-04', { ...monday, state: 'cancelled-by-patient' }, 30 * 60),
  anAppointment('appointment-05', { ...monday, state: 'cancelled-by-practice' }, 60 * 60),
  anAppointment('appointment-06', { ...monday, state: 'expired' }, 30 * 60),
  anAppointment('appointment-07', tuesday, 20 * 60 + 30),
  anAppointment('appointment-08', tuesday, 10 * 60 + 30),
  anAppointment('appointment-09', elsewhereOnTuesday, 60 * 60),
  anAppointment('appointment-10', { ...wednesday, state: 'cancelled-by-patient' }, 30 * 60),
  anAppointment('appointment-11', thursday, 30 * 60),
  anAppointment('appointment-12', { calendarId: 'calendar-3', day: '2026-10-13', practiceId: 'practice-2' }, 30 * 60),
];

/** Appointment 11 is moved from Thursday to Friday once the others are written. */
const RESCHEDULED = anAppointment('appointment-11', friday, 30 * 60);

const LINES = {
  monday: anOccupancy({
    ...monday,
    heldMinutes: 90,
    appointmentsHeld: 3,
    completed: 1,
    noShows: 1,
    cancelledByPatient: 1,
    cancelledByPractice: 1,
  }),
  tuesday: anOccupancy({ ...tuesday, heldMinutes: 32, appointmentsHeld: 2 }),
  elsewhereOnTuesday: anOccupancy({ ...elsewhereOnTuesday, heldMinutes: 60, appointmentsHeld: 1 }),
  wednesday: anOccupancy({ ...wednesday, cancelledByPatient: 1 }),
  friday: anOccupancy({ ...friday, heldMinutes: 30, appointmentsHeld: 1 }),
};

const everyone: ReadScope = { kind: 'all' };
const ofThePractice = Criteria.of<Occupancy>().where('practiceId', 'eq', 'practice-1');

describe.each(ADAPTERS)('The occupancy measured by %s', (_name, create) => {
  it('counts the appointments of a calendar on a day, state by state, and the time of those that hold it', async () => {
    const { occupancy } = await written(await create());

    const page = await occupancy.search(scoped(ofThePractice.where('day', 'eq', '2026-10-12'), everyone));

    expect(page.items).toEqual([LINES.monday]);
  });

  it('counts the time of each appointment to the nearest minute', async () => {
    const { occupancy } = await written(await create());

    const page = await occupancy.search(
      scoped(ofThePractice.where('calendarId', 'eq', 'calendar-1').where('day', 'eq', '2026-10-13'), everyone),
    );

    expect(page.items).toEqual([LINES.tuesday]);
  });

  it('keeps a line for a day whose only appointment was cancelled, with nothing held', async () => {
    const { occupancy } = await written(await create());

    const page = await occupancy.search(scoped(ofThePractice.where('day', 'eq', '2026-10-14'), everyone));

    expect(page.items).toEqual([LINES.wednesday]);
  });

  it('counts a rescheduled appointment on its new day only, and has no line for the day it left empty', async () => {
    const { occupancy } = await written(await create());

    const page = await occupancy.search(
      scoped(ofThePractice.where('day', 'between', ['2026-10-15', '2026-10-16']), everyone),
    );

    expect(page.items).toEqual([LINES.friday]);
  });

  it('no longer counts an outcome that was removed', async () => {
    const measured = await written(await create());

    await measured.outcomes.delete('appointment-09', at(60));

    const page = await measured.occupancy.search(scoped(ofThePractice.where('day', 'eq', '2026-10-13'), everyone));

    expect(page.items).toEqual([LINES.tuesday]);
  });

  it('answers nothing where no appointment was ever announced', async () => {
    const { occupancy } = await create();

    expect(await occupancy.search(scoped(ofThePractice.page(offsetPage()), everyone))).toEqual({ items: [], total: 0 });
  });
});

describe.each(ADAPTERS)('The occupancy read from %s', (_name, create) => {
  it('lists the lines of one practice, never those of another, by day then by calendar', async () => {
    const { occupancy } = await written(await create());

    const page = await occupancy.search(scoped(ofThePractice, everyone));

    expect(page.items).toEqual([LINES.monday, LINES.tuesday, LINES.elsewhereOnTuesday, LINES.wednesday, LINES.friday]);
  });

  it('keeps the days of a range, both ends included, latest first when asked', async () => {
    const { occupancy } = await written(await create());

    const page = await occupancy.search(
      scoped(ofThePractice.where('day', 'between', ['2026-10-13', '2026-10-14']).orderBy('day', 'desc'), everyone),
    );

    expect(page.items).toEqual([LINES.wednesday, LINES.elsewhereOnTuesday, LINES.tuesday]);
  });

  it('keeps the calendars asked for', async () => {
    const { occupancy } = await written(await create());

    const page = await occupancy.search(
      scoped(
        ofThePractice.where('calendarId', 'in', ['calendar-2', 'calendar-3']).where('day', 'lte', '2026-10-14'),
        everyone,
      ),
    );

    expect(page.items).toEqual([LINES.elsewhereOnTuesday, LINES.wednesday]);
  });

  it('orders the lines by the time held, the key deciding between two that hold as much', async () => {
    const { occupancy } = await written(await create());

    const page = await occupancy.search(
      scoped(ofThePractice.where('day', 'gte', '2026-10-13').orderBy('heldMinutes', 'desc'), everyone),
    );

    expect(page.items).toEqual([LINES.elsewhereOnTuesday, LINES.tuesday, LINES.friday, LINES.wednesday]);
  });

  it('refuses to be filtered by a figure', async () => {
    const { occupancy } = await written(await create());

    await expect(occupancy.search(scoped(ofThePractice.where('noShows', 'gte', 1), everyone))).rejects.toMatchObject({
      code: 'INVALID_CRITERIA',
    });
  });
});

describe.each(ADAPTERS)('The occupancy an actor may read from %s', (_name, create) => {
  it('is narrowed to the calendars the actor measures, total included', async () => {
    const { occupancy } = await written(await create());

    const page = await occupancy.search(
      scoped(ofThePractice.page(offsetPage()), { kind: 'ids', ids: ['calendar-1'] }, { ids: 'calendarId' }),
    );

    expect(page).toEqual({ items: [LINES.monday, LINES.tuesday], total: 2 });
  });

  it('is not widened by asking for a calendar the actor does not measure', async () => {
    const { occupancy } = await written(await create());
    const asked = ofThePractice.where('calendarId', 'eq', 'calendar-2').page(offsetPage());

    const page = await occupancy.search(scoped(asked, { kind: 'ids', ids: ['calendar-1'] }, { ids: 'calendarId' }));

    expect(page).toEqual({ items: [], total: 0 });
  });

  it('is empty for an actor who measures no calendar', async () => {
    const { occupancy } = await written(await create());

    const page = await occupancy.search(scoped(ofThePractice.page(offsetPage()), { kind: 'none' }));

    expect(page).toEqual({ items: [], total: 0 });
  });
});

describe.each(ADAPTERS)('The pages of the occupancy read from %s', (_name, create) => {
  it('are slices of the same order, each with the total of the lines', async () => {
    const { occupancy } = await written(await create());

    const first = await occupancy.search(scoped(ofThePractice.page(offsetPage({ limit: 2 })), everyone));
    const second = await occupancy.search(scoped(ofThePractice.page(offsetPage({ offset: 2, limit: 2 })), everyone));

    expect(first).toEqual({ items: [LINES.monday, LINES.tuesday], total: 5 });
    expect(second).toEqual({ items: [LINES.elsewhereOnTuesday, LINES.wednesday], total: 5 });
  });

  it('still say the total past the last line', async () => {
    const { occupancy } = await written(await create());

    const page = await occupancy.search(scoped(ofThePractice.page(offsetPage({ offset: 10, limit: 2 })), everyone));

    expect(page).toEqual({ items: [], total: 5 });
  });

  it('follow one another by cursor, each line once, in the order of the time held', async () => {
    const { occupancy } = await written(await create());
    const byTimeHeld = ofThePractice.orderBy('heldMinutes', 'desc');

    const first = await occupancy.search(scoped(byTimeHeld.page(cursorPage({ limit: 2 })), everyone));

    const second = await occupancy.search(
      scoped(byTimeHeld.page(cursorPage({ limit: 2, ...cursorOf(first.nextCursor) })), everyone),
    );

    const third = await occupancy.search(
      scoped(byTimeHeld.page(cursorPage({ limit: 2, ...cursorOf(second.nextCursor) })), everyone),
    );

    expect([first.items, second.items, third.items]).toEqual([
      [LINES.monday, LINES.elsewhereOnTuesday],
      [LINES.tuesday, LINES.friday],
      [LINES.wednesday],
    ]);

    expect(third.nextCursor).toBeUndefined();
  });
});

function measuredBy<Register extends OutcomeRegister>(
  outcomes: Register,
  reader: (outcomes: Register) => OccupancyReader,
): Measured {
  return { outcomes, occupancy: reader(outcomes) };
}

async function written(measured: Measured): Promise<Measured> {
  for (const outcome of OUTCOMES) {
    await measured.outcomes.upsertIfNewer(outcome.id, at(0), () => outcome);
  }

  await measured.outcomes.upsertIfNewer(RESCHEDULED.id, at(30), () => RESCHEDULED);

  return measured;
}

function anAppointment(id: string, overrides: Partial<Outcome>, seconds: number): Outcome {
  const startsAt = new Date(`${overrides.day ?? '2026-10-12'}T08:00:00.000Z`);

  return anOutcome({ id, ...overrides, startsAt, endsAt: new Date(startsAt.getTime() + seconds * 1000) });
}

function cursorOf(cursor: string | undefined): { readonly cursor?: string } {
  return cursor === undefined ? {} : { cursor };
}

function at(minute: number) {
  return { eventId: `fact-${minute}`, occurredAt: new Date(Date.UTC(2026, 9, 1, 10, minute)) };
}
