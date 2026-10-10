import { describe, expect, it } from 'vitest';
import type { Authorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import * as schedulingDeclarations from '../../scheduling.declarations.js';
import { platformTestModule } from '../../../../platform/platform-test.module.js';
import { Agenda, type AgendaEntry } from '../../application/ports/agenda.port.js';
import { GetAppointmentQuery } from '../../application/queries/get-appointment/get-appointment.query.js';
import { PersonDirectoryGateway } from '../../application/ports/person-directory-gateway.port.js';
import { anAgendaEntry } from '../builders/agenda-entry.builder.js';
import { FakeAgenda } from '../fakes/agenda.fake.js';
import { FakePersonDirectoryGateway } from '../fakes/person-directory-gateway.fake.js';

// As the relationships would answer: the patient of an appointment, and whoever runs its calendar, read it.
const READABLE: Readonly<Record<string, readonly string[]>> = {
  'patient-1': ['appointment-a'],
  'assistant-1': ['appointment-a', 'appointment-b'],
};

const byRelationships: Authorizer = {
  check: async ({ actor, resource }) =>
    resource !== undefined && (READABLE[actor.id] ?? []).includes(resource.id)
      ? { allowed: true }
      : { allowed: false, reason: 'NO_RELATION' },
  listAccessible: async ({ actor }) => ({ kind: 'ids', ids: READABLE[actor.id] ?? [] }),
};

const patient = anActor().named('patient-1').build();
const assistant = anActor().named('assistant-1').build();
const mine = anAgendaEntry().withMany({ id: 'appointment-a', patientId: 'patient-1' }).build();

const theirs = anAgendaEntry()
  .withMany({ id: 'appointment-b', patientId: 'patient-2', status: 'cancelled', cancelledBy: 'practice' })
  .build();

describe('Get appointment', () => {
  it('answers the appointment with the name identity shows for its patient', async () => {
    const { application } = await arrangeWith(mine, theirs);

    const answer = await application.queryBus.execute(new GetAppointmentQuery(patient, 'appointment-a'));

    expect(answer).toEqual({ ...mine, patientName: 'Ada Martin' });
  });

  it('answers to whoever runs the calendar the appointment of another patient', async () => {
    const { application } = await arrangeWith(mine, theirs);

    const answer = await application.queryBus.execute(new GetAppointmentQuery(assistant, 'appointment-b'));

    expect(answer).toMatchObject({
      id: 'appointment-b',
      status: 'cancelled',
      cancelledBy: 'practice',
      patientName: 'Zoe Bernard',
    });
  });

  it('is refused to a patient who asks for the appointment of somebody else', async () => {
    const { application } = await arrangeWith(mine, theirs);

    await expect(application.queryBus.execute(new GetAppointmentQuery(patient, 'appointment-b'))).rejects.toMatchObject(
      { code: 'FORBIDDEN' },
    );
  });

  it('answers the appointment without a name when identity does not know the patient', async () => {
    const unknown = anAgendaEntry().withMany({ id: 'appointment-a', patientId: 'patient-9' }).build();
    const { application } = await arrangeWith(unknown);

    const answer = await application.queryBus.execute(new GetAppointmentQuery(patient, 'appointment-a'));

    expect(answer).toEqual(unknown);
  });

  it('answers the appointment without a name when identity fails', async () => {
    const { application, people } = await arrangeWith(mine);

    people.failNextWith(new Error('identity is unreachable'));

    const answer = await application.queryBus.execute(new GetAppointmentQuery(patient, 'appointment-a'));

    expect(answer).toEqual(mine);
  });

  it('refuses an appointment the agenda does not hold', async () => {
    const { application } = await arrangeWith(theirs);

    await expect(application.queryBus.execute(new GetAppointmentQuery(patient, 'appointment-a'))).rejects.toMatchObject(
      { code: 'APPOINTMENT_NOT_FOUND' },
    );
  });
});

async function arrangeWith(...entries: readonly AgendaEntry[]) {
  const people = new FakePersonDirectoryGateway({ 'patient-1': 'Ada Martin', 'patient-2': 'Zoe Bernard' });

  return { application: await arrange(people, ...entries), people };
}

async function arrange(people: FakePersonDirectoryGateway, ...entries: readonly AgendaEntry[]) {
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
    fakes: [fake(Agenda, agenda), fake(PersonDirectoryGateway, people)],
  });
}
