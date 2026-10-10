import { describe, expect, it } from 'vitest';
import type { Authorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import { Criteria, offsetPage } from '@ddd-ts-kit/kernel';
import * as schedulingDeclarations from '#src/contexts/scheduling/scheduling.declarations.js';
import { platformTestModule } from '#src/platform/platform-test.module.js';
import { Agenda, type AgendaEntry } from '#src/contexts/scheduling/application/ports/agenda.port.js';
import { SearchPracticeAgendaQuery } from '#src/contexts/scheduling/application/queries/search-practice-agenda/search-practice-agenda.query.js';
import { anAgendaEntry } from '#src/contexts/scheduling/test/builders/agenda-entry.builder.js';
import { FakeAgenda } from '#src/contexts/scheduling/test/fakes/agenda.fake.js';

// As the relationships would answer: a member reads the agenda of their practice, narrowed to the calendars they run.
const MEMBERS: Readonly<Record<string, string>> = {
  'manager-1': 'practice-1',
  'practitioner-1': 'practice-1',
  'manager-2': 'practice-2',
};

const CALENDARS: Readonly<Record<string, readonly string[]>> = {
  'manager-1': ['calendar-a', 'calendar-b'],
  'practitioner-1': ['calendar-a'],
  'manager-2': ['calendar-z'],
};

const byRelationships: Authorizer = {
  check: async ({ actor, resource }) =>
    resource?.type === 'practice' && MEMBERS[actor.id] === resource.id
      ? { allowed: true }
      : { allowed: false, reason: 'NO_RELATION' },
  listAccessible: async ({ actor }) => ({ kind: 'ids', ids: CALENDARS[actor.id] ?? [] }),
};

const manager = anActor().named('manager-1').build();
const practitioner = anActor().named('practitioner-1').build();

const ENTRIES = [
  anAgendaEntry()
    .withMany({ id: 'appointment-a', calendarId: 'calendar-a', startsAt: at('10:00') })
    .build(),
  anAgendaEntry()
    .withMany({ id: 'appointment-b', calendarId: 'calendar-b', startsAt: at('09:00') })
    .build(),
  anAgendaEntry()
    .withMany({
      id: 'appointment-c',
      calendarId: 'calendar-a',
      startsAt: new Date('2026-03-03T08:00:00.000Z'),
      day: '2026-03-03',
    })
    .build(),
  anAgendaEntry()
    .withMany({ id: 'appointment-z', calendarId: 'calendar-z', practiceId: 'practice-2', startsAt: at('08:00') })
    .build(),
];

const everything = Criteria.of<AgendaEntry>();

describe('Search practice agenda', () => {
  it('shows a manager the appointments of every calendar of the practice, by start', async () => {
    const application = await arrange(...ENTRIES);

    const page = await application.queryBus.execute(new SearchPracticeAgendaQuery(manager, 'practice-1', everything));

    expect(page.items.map((entry) => entry.id)).toEqual(['appointment-b', 'appointment-a', 'appointment-c']);
  });

  it('narrows the agenda of a practitioner to the calendars they run', async () => {
    const application = await arrange(...ENTRIES);

    const page = await application.queryBus.execute(
      new SearchPracticeAgendaQuery(practitioner, 'practice-1', everything),
    );

    expect(page.items.map((entry) => entry.id)).toEqual(['appointment-a', 'appointment-c']);
  });

  it('shows one day of the agenda, page by page with the total', async () => {
    const application = await arrange(...ENTRIES);
    const monday = everything.where('day', 'eq', '2026-03-02').page(offsetPage({ limit: 1 }));

    const page = await application.queryBus.execute(new SearchPracticeAgendaQuery(manager, 'practice-1', monday));

    expect(page.items.map((entry) => entry.id)).toEqual(['appointment-b']);
    expect(page.total).toBe(2);
  });

  it('is refused to whoever is not a member of that practice, a manager of another one included', async () => {
    const application = await arrange(...ENTRIES);
    const outsider = anActor().named('manager-2').build();

    await expect(
      application.queryBus.execute(new SearchPracticeAgendaQuery(outsider, 'practice-1', everything)),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('never shows the appointments of another practice, whatever the criteria asks for', async () => {
    const application = await arrange(...ENTRIES);

    const elsewhere = everything.or((any) =>
      any.where('practiceId', 'eq', 'practice-2').where('calendarId', 'eq', 'calendar-z'),
    );

    const page = await application.queryBus.execute(new SearchPracticeAgendaQuery(manager, 'practice-1', elsewhere));

    expect(page.items).toEqual([]);
  });
});

async function arrange(...entries: readonly AgendaEntry[]) {
  const agenda = new FakeAgenda();

  await entries.reduce(
    (written, entry, index) =>
      written
        .then(() =>
          agenda.upsertIfNewer(entry.id, { eventId: `event-${index}`, occurredAt: entry.changedAt }, () => entry),
        )
        .then(() => undefined),
    Promise.resolve(),
  );

  return createTestApplication({
    modules: [
      platformTestModule,
      contextModule('scheduling', schedulingDeclarations),
      authorizationModule({ authorizer: byRelationships }),
    ],
    fakes: [fake(Agenda, agenda)],
  });
}

function at(time: string): Date {
  return new Date(`2026-03-02T${time}:00.000Z`);
}
