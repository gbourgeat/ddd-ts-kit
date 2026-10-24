import { Readable } from 'node:stream';
import { SUBJECT_ERASURE_ACTION } from '@ddd-ts-kit/audit';
import {
  AsyncLocalStorageExecutionScope,
  ERASED_PERSONAL_DATA,
  FixedClock,
  FixedExecutionScope,
  InMemoryFileStorage,
  PersonalDataCipher,
  SequentialIdGenerator,
  UnknownDataSubjectError,
  executionContext,
  offsetPage,
  type Actor,
  type EventStamp,
  type ExecutionContext,
  type StoredFile,
} from '@ddd-ts-kit/kernel';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAudit, type Audit } from '@/platform/audit/create-audit';
import { openTestDatabase, type TestDatabase } from '@/platform/database/open-test-database';
import { copiesOfAPerson } from '@/platform/privacy/copies-of-a-person';
import { eraseOnTheCommandLine } from '@/platform/privacy/erase-on-the-command-line';
import { storeFedProjections } from '@/platform/event-store/store-fed-projections';
import { storableStamp } from '@/shared-kernel/storable-stamp';
import { KnexPersonDirectory } from '@/contexts/identity/infrastructure/persistence/knex-person-directory.reader';
import { KnexPersonRepository } from '@/contexts/identity/infrastructure/persistence/knex-person.repository';
import { aPerson } from '@/contexts/identity/test/builders/person.builder';
import { KnexContacts } from '@/contexts/notification/infrastructure/persistence/knex-contacts.repository';
import { AttachedDocument } from '@/contexts/scheduling/calendars/domain/value-objects/attached-document.vo';
import { Cancellation } from '@/contexts/scheduling/calendars/domain/value-objects/cancellation.vo';
import { AppointmentStatus } from '@/contexts/scheduling/calendars/domain/vocabularies/appointment-status.vocabulary';
import { KnexAgenda } from '@/contexts/scheduling/calendars/infrastructure/persistence/knex-agenda.repository';
import { KnexAppointmentRepository } from '@/contexts/scheduling/calendars/infrastructure/persistence/knex-appointment.repository';
import { KnexPractitionerDirectory } from '@/contexts/scheduling/calendars/infrastructure/persistence/knex-practitioner-directory.repository';
import { anAppointment } from '@/contexts/scheduling/test/builders/appointment.builder';

const NOW = new Date('2026-02-01T09:00:00.000Z');
const PDF = '%PDF-1.7\n%%EOF\n';
const STARTS_AT = new Date('2026-03-02T09:00:00.000Z');
const ENDS_AT = new Date('2026-03-02T09:30:00.000Z');

/** Ada is known to two networks: a patient of `acme`, a practitioner of `north`. Bob, a patient of `acme`, stays. */
const acme = new FixedExecutionScope(registrationIn('acme'));
const north = new FixedExecutionScope(registrationIn('north'));

const scope = new AsyncLocalStorageExecutionScope();
const clock = new FixedClock(NOW);
const ids = new SequentialIdGenerator('erase-a-person');
const files = new InMemoryFileStorage();

let database: TestDatabase;
let audit: Audit;
let persons: KnexPersonRepository;
let contacts: KnexContacts;
let appointments: KnexAppointmentRepository;
let agenda: KnexAgenda;
let practitioners: KnexPractitionerDirectory;
let referral: StoredFile;

beforeAll(async () => {
  database = await openTestDatabase();
  audit = createAudit(database.persistence, { scope, clock, ids });

  const { database: context } = database.persistence;

  persons = new KnexPersonRepository(context, acme, clock);
  contacts = new KnexContacts(context, acme);
  appointments = new KnexAppointmentRepository(context, acme, clock);
  agenda = new KnexAgenda(context, acme);
  practitioners = new KnexPractitionerDirectory(context, north);

  await seedIdentityAndNotification();
  await seedScheduling();
  await database.persistence.eventSourcing.subjectKeys.keyFor('ada');
});

afterAll(async () => {
  await database.close();
});

describe('npm run privacy:erase, on a person every context keeps a copy of', () => {
  it('erases the person wherever a context keeps them in clear, in every network, and reports what it reached', async () => {
    const report = await erase('ada', 'operator-7');

    expect(report.erased).toBe(true);
    // The rows each copy reached: the person, the contact, the two appointments, the agenda and the directory.
    expect(report.copies).toEqual({ identity: 1, notification: 1, scheduling: 4 });

    // identity: the person is gone; notification: the address is gone.
    expect(await persons.findById('ada')).toBeUndefined();
    expect(await contacts.get('ada')).toBeUndefined();

    // scheduling: the appointments stay, with what the staff wrote and the patient said replaced, and no document.
    const noted = await appointments.findById('visit-1');
    const cancelled = await appointments.findById('visit-2');

    expect(noted?.internalNote).toBe(ERASED_PERSONAL_DATA);
    expect(noted?.document).toBeUndefined();
    expect(await files.stat(referral.key)).toBeUndefined();
    expect(cancelled?.toState().cancellation?.reason).toBe(ERASED_PERSONAL_DATA);
    expect((await agenda.get('visit-1'))?.internalNote).toBe(ERASED_PERSONAL_DATA);

    // The other network: the name the practitioner directory copied from identity.
    expect((await practitioners.get('practice-9.ada'))?.displayName).toBe(ERASED_PERSONAL_DATA);

    // The proof, in the global chain.
    expect(await erasuresOf('ada')).toEqual([
      expect.objectContaining({ actor: { id: 'operator-7', type: 'user' }, changes: { keyDestroyed: true } }),
    ]);
  });

  it('leaves everyone else as they were', async () => {
    expect((await persons.findById('bob'))?.displayName.value).toBe('Bob Hope');
    expect(await contacts.get('bob')).toEqual({ recipientId: 'bob', address: 'bob@example.org' });
    expect((await appointments.findById('visit-3'))?.internalNote).toBe('Prefers mornings');
    expect((await agenda.get('visit-3'))?.internalNote).toBe('Prefers mornings');
    expect((await practitioners.get('practice-9.zoe'))?.displayName).toBe('Zoe Bernard');
  });

  it('refuses a run again once nothing of the person is left anywhere, and the trail still records the attempt', async () => {
    await expect(erase('ada', 'operator-8')).rejects.toThrow(UnknownDataSubjectError);

    expect((await erasuresOf('ada')).map(({ actor, changes }) => ({ actor: actor.id, changes }))).toEqual([
      { actor: 'operator-7', changes: { keyDestroyed: true } },
      { actor: 'operator-8', changes: { keyDestroyed: false } },
    ]);
  });
});

function erase(patientId: string, operator: string) {
  const parts = {
    keys: audit.subjectKeys,
    rebuilds: storeFedProjections(database.persistence, new PersonalDataCipher(audit.subjectKeys)),
    copies: copiesOfAPerson(database.persistence, { scope, clock, files }),
  };

  const directory = new KnexPersonDirectory(database.persistence.database, scope);
  const options = { scope, ids, operator, persons: directory, elevate: audit.elevate, networks: ['acme', 'north'] };

  return eraseOnTheCommandLine(patientId, parts, options);
}

async function seedIdentityAndNotification(): Promise<void> {
  await persons.save(aPerson().identifiedBy('ada').named('Ada Lovelace').reachedAt('ada@example.org').build());
  await persons.save(aPerson().identifiedBy('bob').named('Bob Hope').reachedAt('bob@example.org').build());

  await contacts.upsertIfNewer('ada', stamp('registered-ada'), () => ({
    recipientId: 'ada',
    address: 'ada@example.org',
  }));

  await contacts.upsertIfNewer('bob', stamp('registered-bob'), () => ({
    recipientId: 'bob',
    address: 'bob@example.org',
  }));
}

/** Two appointments of Ada, one annotated with a document, one cancelled with her words; one of Bob; Ada and Zoe as practitioners of `north`. */
async function seedScheduling(): Promise<void> {
  referral = await files.put('tenants/acme/appointment-documents/referral', Readable.from([Buffer.from(PDF)]), {
    mediaType: 'application/pdf',
  });

  const noted = anAppointment().identifiedBy('visit-1').forPatient('ada').startingAt(STARTS_AT).build();
  const cancelled = anAppointment().identifiedBy('visit-2').forPatient('ada').startingAt(STARTS_AT).build();
  const bobs = anAppointment().identifiedBy('visit-3').forPatient('bob').startingAt(STARTS_AT).build();

  noted.annotate('Allergic to penicillin', NOW);
  noted.attachDocument(AttachedDocument.create(referral, 'referral.pdf', NOW), NOW);
  cancelled.cancel(Cancellation.create('patient', 'Moving abroad'), NOW);
  bobs.annotate('Prefers mornings', NOW);

  for (const appointment of [noted, cancelled, bobs]) {
    await appointments.save(appointment);
  }

  await agenda.upsertIfNewer('visit-1', stamp('agenda-1'), () =>
    agendaEntryOf('visit-1', 'ada', 'Allergic to penicillin'),
  );

  await agenda.upsertIfNewer('visit-3', stamp('agenda-3'), () => agendaEntryOf('visit-3', 'bob', 'Prefers mornings'));

  await practitioners.upsertIfNewer('practice-9.ada', stamp('member-ada'), () => practitionerOf('ada', 'Ada Lovelace'));
  await practitioners.upsertIfNewer('practice-9.zoe', stamp('member-zoe'), () => practitionerOf('zoe', 'Zoe Bernard'));
}

function agendaEntryOf(id: string, patientId: string, internalNote: string) {
  return {
    id,
    calendarId: `calendar-${id}`,
    practiceId: 'practice-1',
    practitionerId: 'practitioner-1',
    patientId,
    appointmentTypeId: 'consultation',
    startsAt: STARTS_AT,
    endsAt: ENDS_AT,
    heldUntil: ENDS_AT,
    day: '2026-03-02',
    status: AppointmentStatus.Booked,
    confirmBefore: null,
    cancelledBy: null,
    internalNote,
    changedAt: NOW,
  };
}

function practitionerOf(personId: string, displayName: string) {
  return {
    id: `practice-9.${personId}`,
    practiceId: 'practice-9',
    practitionerId: personId,
    displayName,
    timeZone: 'Europe/Paris',
  };
}

function stamp(eventId: string): EventStamp {
  return storableStamp({ eventId, occurredAt: new Date('2026-01-15T08:00:00.000Z') });
}

function registrationIn(tenantId: string): ExecutionContext {
  const registrar: Actor = { id: `registrar-of-${tenantId}`, type: 'user', tenantId, roles: [], attributes: {} };

  return executionContext({ correlationId: 'erase-a-person-spec', actor: registrar, origin: 'test' });
}

async function erasuresOf(patientId: string) {
  const page = await audit.trail.search(
    { action: SUBJECT_ERASURE_ACTION, resource: { type: 'data-subject', id: patientId } },
    offsetPage({ offset: 0, limit: 10, sort: [{ field: 'sequence', direction: 'asc' }] }),
  );

  return page.items;
}
