import { describe, expect, it } from 'vitest';
import type { Authorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import * as schedulingDeclarations from '@/contexts/scheduling/scheduling.declarations';
import { platformTestModule } from '@/platform/platform-test.module';
import { Agenda, type AgendaEntry } from '@/contexts/scheduling/application/ports/agenda.port';
import { ExportPracticeAgendaQuery } from '@/contexts/scheduling/application/queries/export-practice-agenda/export-practice-agenda.query';
import { anAgendaEntry } from '@/contexts/scheduling/test/builders/agenda-entry.builder';
import { FakeAgenda } from '@/contexts/scheduling/test/fakes/agenda.fake';

// As the relationships would answer: a member reads the agenda of their practice, narrowed to the calendars they run.
const byRelationships: Authorizer = {
  check: async ({ actor, resource }) =>
    resource?.type === 'practice' && resource.id === 'practice-1' && actor.id !== 'outsider'
      ? { allowed: true }
      : { allowed: false, reason: 'NO_RELATION' },
  listAccessible: async ({ actor }) => ({
    kind: 'ids',
    ids: actor.id === 'manager' ? ['calendar-a', 'calendar-b'] : ['calendar-a'],
  }),
};

/** More appointments than one page of the agenda holds: the export reads every page. */
const MANY = 230;

describe('Export practice agenda', () => {
  it('hands over every appointment of the calendars the actor runs, page after page, in the order they start', async () => {
    const entries = Array.from({ length: MANY }, (_, index) =>
      anAgendaEntry()
        .withMany({
          id: `appointment-${String(index).padStart(3, '0')}`,
          calendarId: index % 2 === 0 ? 'calendar-a' : 'calendar-b',
          startsAt: new Date(Date.UTC(2026, 2, 2, 8, index)),
        })
        .build(),
    );

    const application = await arrange(...entries);

    const manager = await all(
      application.queryBus.execute(new ExportPracticeAgendaQuery(anActor().named('manager').build(), 'practice-1')),
    );

    const practitioner = await all(
      application.queryBus.execute(
        new ExportPracticeAgendaQuery(anActor().named('practitioner').build(), 'practice-1'),
      ),
    );

    expect(manager).toHaveLength(MANY);
    expect(manager.map(({ id }) => id)).toEqual(entries.map(({ id }) => id));
    expect(practitioner.every(({ calendarId }) => calendarId === 'calendar-a')).toBe(true);
    expect(practitioner).toHaveLength(MANY / 2);
  });

  it('never hands over the appointments of another practice', async () => {
    const application = await arrange(
      anAgendaEntry().withMany({ id: 'elsewhere', calendarId: 'calendar-a', practiceId: 'practice-2' }).build(),
    );

    expect(
      await all(
        application.queryBus.execute(new ExportPracticeAgendaQuery(anActor().named('manager').build(), 'practice-1')),
      ),
    ).toEqual([]);
  });

  it('is refused to whoever is not a member of the practice', async () => {
    const application = await arrange();

    await expect(
      application.queryBus.execute(new ExportPracticeAgendaQuery(anActor().named('outsider').build(), 'practice-1')),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

async function all(exported: Promise<AsyncIterable<AgendaEntry>>): Promise<AgendaEntry[]> {
  const read: AgendaEntry[] = [];

  for await (const entry of await exported) {
    read.push(entry);
  }

  return read;
}

async function arrange(...entries: readonly AgendaEntry[]) {
  const agenda = new FakeAgenda();

  for (const [index, entry] of entries.entries()) {
    await agenda.upsertIfNewer(
      entry.id,
      { eventId: `event-${String(index)}`, occurredAt: entry.changedAt },
      () => entry,
    );
  }

  return createTestApplication({
    modules: [
      platformTestModule,
      contextModule('scheduling', schedulingDeclarations),
      authorizationModule({ authorizer: byRelationships }),
    ],
    fakes: [fake(Agenda, agenda)],
  });
}
