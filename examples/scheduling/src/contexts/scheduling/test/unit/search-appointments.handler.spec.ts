import { describe, expect, it } from 'vitest';
import type { Authorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import { Criteria, offsetPage } from '@ddd-ts-kit/kernel';
import * as schedulingDeclarations from '#src/contexts/scheduling/scheduling.declarations.js';
import { platformTestModule } from '#src/platform/platform-test.module.js';
import { Agenda, type AgendaEntry } from '#src/contexts/scheduling/application/ports/agenda.port.js';
import { SearchAppointmentsQuery } from '#src/contexts/scheduling/application/queries/search-appointments/search-appointments.query.js';
import { anAgendaEntry } from '#src/contexts/scheduling/test/builders/agenda-entry.builder.js';
import { FakeAgenda } from '#src/contexts/scheduling/test/fakes/agenda.fake.js';

// As the relationships would answer: anybody signed in may list, and reads the appointments related to them.
const READABLE: Readonly<Record<string, readonly string[]>> = {
  'patient-1': ['appointment-a', 'appointment-c'],
  'assistant-1': ['appointment-a', 'appointment-b', 'appointment-c'],
};

const byRelationships: Authorizer = {
  check: async ({ actor }) =>
    actor.roles.includes('signed-in') ? { allowed: true } : { allowed: false, reason: 'NO_MATCHING_ROLE' },
  listAccessible: async ({ actor }) => ({ kind: 'ids', ids: READABLE[actor.id] ?? [] }),
};

const patient = anActor().named('patient-1').withRole('signed-in').build();
const assistant = anActor().named('assistant-1').withRole('signed-in').build();

const ENTRIES = [
  anAgendaEntry()
    .withMany({ id: 'appointment-a', startsAt: at('10:00'), status: 'booked' })
    .build(),
  anAgendaEntry()
    .withMany({ id: 'appointment-b', startsAt: at('09:00'), status: 'booked', patientId: 'patient-2' })
    .build(),
  anAgendaEntry()
    .withMany({ id: 'appointment-c', startsAt: at('08:00'), status: 'cancelled', cancelledBy: 'patient' })
    .build(),
  anAgendaEntry()
    .withMany({ id: 'appointment-d', startsAt: at('07:00'), patientId: 'patient-3' })
    .build(),
];

const everything = Criteria.of<AgendaEntry>();

describe('Search appointments', () => {
  it('answers one page of what the actor may read, by start, with the total', async () => {
    const application = await arrange(...ENTRIES);

    const page = await application.queryBus.execute(
      new SearchAppointmentsQuery(assistant, everything.page(offsetPage({ limit: 2 }))),
    );

    expect(page.items.map((entry) => entry.id)).toEqual(['appointment-c', 'appointment-b']);
    expect(page.total).toBe(3);
  });

  it('lists to a patient their own appointments and no other', async () => {
    const application = await arrange(...ENTRIES);

    const page = await application.queryBus.execute(new SearchAppointmentsQuery(patient, everything));

    expect(page.items.map((entry) => entry.id)).toEqual(['appointment-c', 'appointment-a']);
  });

  it('lists nothing to an actor nothing is related to', async () => {
    const application = await arrange(...ENTRIES);

    const page = await application.queryBus.execute(
      new SearchAppointmentsQuery(anActor().named('stranger').withRole('signed-in').build(), everything),
    );

    expect(page.items).toEqual([]);
  });

  it('applies the filters and the sort of the criteria inside what the actor may read', async () => {
    const application = await arrange(...ENTRIES);
    const booked = everything.where('status', 'eq', 'booked').orderBy('startsAt', 'desc');

    const page = await application.queryBus.execute(new SearchAppointmentsQuery(assistant, booked));

    expect(page.items.map((entry) => entry.id)).toEqual(['appointment-a', 'appointment-b']);
  });

  it('never widens what the actor may read, whatever alternative the criteria names', async () => {
    const application = await arrange(...ENTRIES);

    const widened = everything.or((any) =>
      any.where('patientId', 'eq', 'patient-1').where('patientId', 'eq', 'patient-3'),
    );

    const page = await application.queryBus.execute(new SearchAppointmentsQuery(patient, widened));

    expect(page.items.map((entry) => entry.id)).toEqual(['appointment-c', 'appointment-a']);
  });

  it('refuses a criteria the agenda does not declare', async () => {
    const application = await arrange(...ENTRIES);
    const unsortable = everything.orderBy('endsAt');

    await expect(
      application.queryBus.execute(new SearchAppointmentsQuery(assistant, unsortable)),
    ).rejects.toMatchObject({
      code: 'INVALID_CRITERIA',
    });
  });

  it('is refused to an actor who does not hold the permission appointment.search', async () => {
    const application = await arrange(...ENTRIES);

    await expect(
      application.queryBus.execute(new SearchAppointmentsQuery(anActor().build(), everything)),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
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
