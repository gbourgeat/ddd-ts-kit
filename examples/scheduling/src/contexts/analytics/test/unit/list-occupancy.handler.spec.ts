import { describe, expect, it } from 'vitest';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { RelationTupleStore } from '@ddd-ts-kit/auth/rebac';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import * as analyticsDeclarations from '../../analytics.declarations.js';
import { Criteria, offsetPage } from '@ddd-ts-kit/kernel';
import { createAuthorizer } from '../../../../platform/auth/create-authorizer.js';
import { platformTestModule } from '../../../../platform/platform-test.module.js';
import { OccupancyRegister, type Occupancy } from '../../application/ports/occupancy-register.port.js';
import { OutcomeRegister } from '../../application/ports/outcome-register.port.js';
import { ListOccupancyQuery } from '../../application/queries/list-occupancy/list-occupancy.query.js';
import { anOccupancy } from '../builders/occupancy.builder.js';
import { FakeOccupancyRegister } from '../fakes/occupancy-register.fake.js';
import { FakeOutcomeRegister } from '../fakes/outcome-register.fake.js';

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

const LINES: readonly Occupancy[] = [
  anOccupancy({ calendarId: 'calendar-1', day: '2026-10-12', heldMinutes: 30 }),
  anOccupancy({ calendarId: 'calendar-1', day: '2026-10-13', heldMinutes: 60 }),
  anOccupancy({ calendarId: 'calendar-2', day: '2026-10-12', heldMinutes: 90 }),
  anOccupancy({ calendarId: 'calendar-2', day: '2026-10-14', heldMinutes: 120 }),
  anOccupancy({ calendarId: 'calendar-3', day: '2026-10-12', practiceId: 'practice-2', heldMinutes: 45 }),
];

const manager = anActor().named('manager-1').build();
const practitioner = anActor().named('practitioner-1').build();
const everything = Criteria.of<Occupancy>();

describe('List occupancy', () => {
  it('answers one page of what the actor may see, with the total', async () => {
    const application = await arrange();

    const page = await application.queryBus.execute(new ListOccupancyQuery(manager, 'practice-1', everything.page(offsetPage({ limit: 2 }))));

    expect(page).toEqual({ items: [LINES[0], LINES[2]], total: 4 });
  });

  it('is refused to an actor who does not hold the permission occupancy.read', async () => {
    const application = await arrange();

    await expect(application.queryBus.execute(new ListOccupancyQuery(anActor().build(), 'practice-1', everything))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('shows the manager of a practice every calendar of it, and nothing of another practice', async () => {
    const application = await arrange();

    const page = await application.queryBus.execute(new ListOccupancyQuery(manager, 'practice-1', everything));

    expect(page.items.map((line) => line.id)).toEqual(['calendar-1.2026-10-12', 'calendar-2.2026-10-12', 'calendar-1.2026-10-13', 'calendar-2.2026-10-14']);
  });

  it('shows a practitioner their own calendars only', async () => {
    const application = await arrange();

    const page = await application.queryBus.execute(new ListOccupancyQuery(practitioner, 'practice-1', everything.page(offsetPage())));

    expect(page.items.map((line) => line.calendarId)).toEqual(['calendar-1', 'calendar-1']);
    expect(page.total).toBe(2);
  });

  it('refuses the occupancy of a practice to the manager of another one', async () => {
    const application = await arrange();

    await expect(application.queryBus.execute(new ListOccupancyQuery(anActor().named('manager-2').build(), 'practice-1', everything))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('keeps the days and the calendar asked for, in the order asked', async () => {
    const application = await arrange();
    const asked = everything.where('day', 'between', ['2026-10-13', '2026-10-14']).orderBy('day', 'desc');

    const page = await application.queryBus.execute(new ListOccupancyQuery(manager, 'practice-1', asked));

    expect(page.items.map((line) => line.id)).toEqual(['calendar-2.2026-10-14', 'calendar-1.2026-10-13']);
  });

  it('never widens what a practitioner sees, whatever calendar is asked for', async () => {
    const application = await arrange();
    const asked = everything.where('calendarId', 'eq', 'calendar-2');

    const page = await application.queryBus.execute(new ListOccupancyQuery(practitioner, 'practice-1', asked));

    expect(page.items).toEqual([]);
  });
});

async function arrange() {
  const occupancy = new FakeOccupancyRegister();

  const application = createTestApplication({
    modules: [platformTestModule, contextModule('analytics', analyticsDeclarations), relationships],
    fakes: [fake(OccupancyRegister, occupancy), fake(OutcomeRegister, new FakeOutcomeRegister())],
  });

  await application.get(RelationTupleStore).write(TUPLES);

  for (const line of LINES) await occupancy.upsertIfNewer(line.id, { eventId: `fact-of-${line.id}`, occurredAt: new Date('2026-10-01T10:00:00.000Z') }, () => line);

  return application;
}
