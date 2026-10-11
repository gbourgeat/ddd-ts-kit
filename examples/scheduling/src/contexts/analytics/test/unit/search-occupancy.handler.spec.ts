import { describe, expect, it } from 'vitest';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { RelationTupleStore } from '@ddd-ts-kit/auth/rebac';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import * as analyticsDeclarations from '@/contexts/analytics/analytics.declarations';
import { Criteria, offsetPage } from '@ddd-ts-kit/kernel';
import { createAuthorizer } from '@/platform/auth/create-authorizer';
import { platformTestModule } from '@/platform/platform-test.module';
import { OccupancyReader, type Occupancy } from '@/contexts/analytics/application/ports/occupancy-reader.port';
import { OutcomeRegister, type Outcome } from '@/contexts/analytics/application/ports/outcome-register.port';
import { SearchOccupancyQuery } from '@/contexts/analytics/application/queries/search-occupancy/search-occupancy.query';
import { anOccupancy } from '@/contexts/analytics/test/builders/occupancy.builder';
import { anOutcome } from '@/contexts/analytics/test/builders/outcome.builder';
import { FakeOccupancyReader } from '@/contexts/analytics/test/fakes/occupancy-reader.fake';
import { FakeOutcomeRegister } from '@/contexts/analytics/test/fakes/outcome-register.fake';

/** The relationships of the platform decide, as in the application: practice-1 has two desks, practice-2 one. */
const relationships = authorizationModule({ authorizer: (resolve) => createAuthorizer(resolve(RelationTupleStore)) });

const TUPLES = [
  { object: 'practice:practice-1', relation: 'manager', subject: 'user:manager-1' },
  { object: 'practice:practice-1', relation: 'practitioner', subject: 'user:practitioner-1' },
  { object: 'practice:practice-2', relation: 'manager', subject: 'user:manager-2' },
  { object: 'desk:practice-1.practitioner-1', relation: 'holder', subject: 'user:practitioner-1' },
  { object: 'desk:practice-1.practitioner-1', relation: 'practice', subject: 'practice:practice-1' },
  { object: 'desk:practice-1.practitioner-2', relation: 'practice', subject: 'practice:practice-1' },
  { object: 'desk:practice-2.practitioner-3', relation: 'practice', subject: 'practice:practice-2' },
  { object: 'calendar:calendar-1', relation: 'desk', subject: 'desk:practice-1.practitioner-1' },
  { object: 'calendar:calendar-2', relation: 'desk', subject: 'desk:practice-1.practitioner-2' },
  { object: 'calendar:calendar-3', relation: 'desk', subject: 'desk:practice-2.practitioner-3' },
];

/** One appointment held on each calendar and day: the occupancy is measured from them when it is read. */
const OUTCOMES: readonly Outcome[] = [
  anAppointment('appointment-1', { calendarId: 'calendar-1', day: '2026-10-12' }, 30),
  anAppointment('appointment-2', { calendarId: 'calendar-1', day: '2026-10-13' }, 60),
  anAppointment('appointment-3', { calendarId: 'calendar-2', day: '2026-10-12' }, 90),
  anAppointment('appointment-4', { calendarId: 'calendar-2', day: '2026-10-14' }, 120),
  anAppointment('appointment-5', { calendarId: 'calendar-3', day: '2026-10-12', practiceId: 'practice-2' }, 45),
];

const LINES: readonly Occupancy[] = OUTCOMES.map(({ practiceId, calendarId, day, startsAt, endsAt }) =>
  anOccupancy({
    practiceId,
    calendarId,
    day,
    heldMinutes: (endsAt.getTime() - startsAt.getTime()) / 60_000,
    appointmentsHeld: 1,
  }),
);

const manager = anActor().named('manager-1').build();
const practitioner = anActor().named('practitioner-1').build();
const everything = Criteria.of<Occupancy>();

describe('Search occupancy', () => {
  it('answers one page of what the actor may see, with the total', async () => {
    const application = await arrange();

    const page = await application.queryBus.execute(
      new SearchOccupancyQuery(manager, 'practice-1', everything.page(offsetPage({ limit: 2 }))),
    );

    expect(page).toEqual({ items: [LINES[0], LINES[2]], total: 4 });
  });

  it('is refused to an actor who does not hold the permission occupancy.read', async () => {
    const application = await arrange();

    await expect(
      application.queryBus.execute(new SearchOccupancyQuery(anActor().build(), 'practice-1', everything)),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('shows the manager of a practice every calendar of it, and nothing of another practice', async () => {
    const application = await arrange();

    const page = await application.queryBus.execute(new SearchOccupancyQuery(manager, 'practice-1', everything));

    expect(page.items.map((line) => line.id)).toEqual([
      'calendar-1.2026-10-12',
      'calendar-2.2026-10-12',
      'calendar-1.2026-10-13',
      'calendar-2.2026-10-14',
    ]);
  });

  it('shows a practitioner their own calendars only', async () => {
    const application = await arrange();

    const page = await application.queryBus.execute(
      new SearchOccupancyQuery(practitioner, 'practice-1', everything.page(offsetPage())),
    );

    expect(page.items.map((line) => line.calendarId)).toEqual(['calendar-1', 'calendar-1']);
    expect(page.total).toBe(2);
  });

  it('refuses the occupancy of a practice to the manager of another one', async () => {
    const application = await arrange();

    await expect(
      application.queryBus.execute(
        new SearchOccupancyQuery(anActor().named('manager-2').build(), 'practice-1', everything),
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('keeps the days and the calendar asked for, in the order asked', async () => {
    const application = await arrange();
    const asked = everything.where('day', 'between', ['2026-10-13', '2026-10-14']).orderBy('day', 'desc');

    const page = await application.queryBus.execute(new SearchOccupancyQuery(manager, 'practice-1', asked));

    expect(page.items.map((line) => line.id)).toEqual(['calendar-2.2026-10-14', 'calendar-1.2026-10-13']);
  });

  it('never widens what a practitioner sees, whatever calendar is asked for', async () => {
    const application = await arrange();
    const asked = everything.where('calendarId', 'eq', 'calendar-2');

    const page = await application.queryBus.execute(new SearchOccupancyQuery(practitioner, 'practice-1', asked));

    expect(page.items).toEqual([]);
  });
});

async function arrange() {
  const outcomes = new FakeOutcomeRegister();

  const application = createTestApplication({
    modules: [platformTestModule, contextModule('analytics', analyticsDeclarations), relationships],
    fakes: [fake(OccupancyReader, new FakeOccupancyReader(outcomes)), fake(OutcomeRegister, outcomes)],
  });

  await application.get(RelationTupleStore).write(TUPLES);

  for (const outcome of OUTCOMES) {
    await outcomes.upsertIfNewer(
      outcome.id,
      { eventId: `fact-of-${outcome.id}`, occurredAt: new Date('2026-10-01T10:00:00.000Z') },
      () => outcome,
    );
  }

  return application;
}

function anAppointment(id: string, place: Partial<Outcome>, minutes: number): Outcome {
  const startsAt = new Date('2026-10-12T08:00:00.000Z');

  return anOutcome({ id, ...place, startsAt, endsAt: new Date(startsAt.getTime() + minutes * 60_000) });
}
