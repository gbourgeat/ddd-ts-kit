import { PERSONAL_DATA_EXPORT_ACTION } from '@ddd-ts-kit/audit';
import {
  AsyncLocalStorageExecutionScope,
  FixedClock,
  FixedExecutionScope,
  NotADataSubjectIdError,
  PERSONAL_DATA_EXPORT_FORMAT,
  SequentialIdGenerator,
  UnknownDataSubjectError,
  executionContext,
  offsetPage,
  type Actor,
  type EventStamp,
  type ExecutionContext,
} from '@ddd-ts-kit/kernel';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAudit, type Audit } from '@/platform/audit/create-audit';
import { openTestDatabase, type TestDatabase } from '@/platform/database/open-test-database';
import { exportOnTheCommandLine } from '@/platform/privacy/export-on-the-command-line';
import { exportsOfAPerson } from '@/platform/privacy/exports-of-a-person';
import { storableStamp } from '@/shared-kernel/storable-stamp';
import { KnexPersonDirectory } from '@/contexts/identity/infrastructure/persistence/knex-person-directory.reader';
import { KnexPersonRepository } from '@/contexts/identity/infrastructure/persistence/knex-person.repository';
import { aPerson } from '@/contexts/identity/test/builders/person.builder';
import { KnexContacts } from '@/contexts/notification/infrastructure/persistence/knex-contacts.repository';
import { KnexAppointmentRepository } from '@/contexts/scheduling/calendars/infrastructure/persistence/knex-appointment.repository';
import { KnexPractitionerDirectory } from '@/contexts/scheduling/calendars/infrastructure/persistence/knex-practitioner-directory.repository';
import { anAppointment } from '@/contexts/scheduling/test/builders/appointment.builder';

const NOW = new Date('2026-02-01T09:00:00.000Z');

/** Ada is known to two networks: a patient of `acme`, a practitioner of `north`. Bob, a patient of `acme`, is not handed over. */
const acme = new FixedExecutionScope(registrationIn('acme'));
const north = new FixedExecutionScope(registrationIn('north'));

const scope = new AsyncLocalStorageExecutionScope();
const clock = new FixedClock(NOW);
const ids = new SequentialIdGenerator('export-a-person');

let database: TestDatabase;
let audit: Audit;

beforeAll(async () => {
  database = await openTestDatabase();
  audit = createAudit(database.persistence, { scope, clock, ids });

  const { database: context } = database.persistence;

  await new KnexPersonRepository(context, acme, clock).save(
    aPerson().identifiedBy('ada').named('Ada Lovelace').reachedAt('ada@example.org').build(),
  );

  await new KnexPersonRepository(context, acme, clock).save(
    aPerson().identifiedBy('bob').named('Bob Hope').reachedAt('bob@example.org').build(),
  );

  await new KnexContacts(context, acme).upsertIfNewer('ada', stamp('registered-ada'), () => ({
    recipientId: 'ada',
    address: 'ada@example.org',
  }));

  const noted = anAppointment().identifiedBy('visit-1').forPatient('ada').build();

  noted.annotate('Allergic to penicillin', NOW);
  await new KnexAppointmentRepository(context, acme, clock).save(noted);

  await new KnexPractitionerDirectory(context, north).upsertIfNewer('practice-9.ada', stamp('member-ada'), () => ({
    id: 'practice-9.ada',
    practiceId: 'practice-9',
    practitionerId: 'ada',
    displayName: 'Ada Lovelace',
    timeZone: 'Europe/Paris',
  }));
});

afterAll(async () => {
  await database.close();
});

describe('npm run privacy:export, on a person every context keeps a copy of', () => {
  it('hands over what every context keeps of the person, in every network, as one dated document', async () => {
    const document = await exportOf('ada', 'operator-7');

    expect(document).toMatchObject({ format: PERSONAL_DATA_EXPORT_FORMAT, subject: 'ada', exportedAt: NOW });

    expect(document.records).toEqual([
      { source: 'identity.persons', values: { display_name: 'Ada Lovelace', email: 'ada@example.org' } },
      { source: 'notification.contacts', values: { address: 'ada@example.org' } },
      expect.objectContaining({
        source: 'scheduling.appointments',
        values: expect.objectContaining({ internal_note: 'Allergic to penicillin', document_key: null }),
      }),
      { source: 'scheduling.practitioners', values: { display_name: 'Ada Lovelace' } },
    ]);
  });

  it('writes every handover to the trail, one per context and network, with the operator and the number of records, never the values', async () => {
    const entries = await exportsOf('ada');

    const handovers = entries.map(({ actor, context, tenantId, changes }) => ({
      actor: actor.id,
      context,
      network: tenantId,
      changes,
    }));

    expect(handovers).toHaveLength(6);

    expect(handovers).toEqual(
      expect.arrayContaining([
        { actor: 'operator-7', context: 'identity', network: 'acme', changes: { records: 1 } },
        { actor: 'operator-7', context: 'identity', network: 'north', changes: { records: 0 } },
        { actor: 'operator-7', context: 'notification', network: 'acme', changes: { records: 1 } },
        { actor: 'operator-7', context: 'notification', network: 'north', changes: { records: 0 } },
        { actor: 'operator-7', context: 'scheduling', network: 'acme', changes: { records: 1 } },
        { actor: 'operator-7', context: 'scheduling', network: 'north', changes: { records: 1 } },
      ]),
    );
  });

  it('refuses an id no network knows, and a value that is not an opaque identifier', async () => {
    await expect(exportOf('nobody', 'operator-7')).rejects.toThrow(UnknownDataSubjectError);
    await expect(exportOf('ada@example.org', 'operator-7')).rejects.toThrow(NotADataSubjectIdError);
  });
});

function exportOf(patientId: string, operator: string) {
  const persons = new KnexPersonDirectory(database.persistence.database, scope);

  return exportOnTheCommandLine(patientId, exportsOfAPerson(database.persistence, scope), {
    scope,
    clock,
    ids,
    operator,
    persons,
    audit,
    networks: ['acme', 'north'],
  });
}

function stamp(eventId: string): EventStamp {
  return storableStamp({ eventId, occurredAt: new Date('2026-01-15T08:00:00.000Z') });
}

function registrationIn(tenantId: string): ExecutionContext {
  const registrar: Actor = { id: `registrar-of-${tenantId}`, type: 'user', tenantId, roles: [], attributes: {} };

  return executionContext({ correlationId: 'export-a-person-spec', actor: registrar, origin: 'test' });
}

async function exportsOf(patientId: string) {
  const page = await audit.trail.search(
    { action: PERSONAL_DATA_EXPORT_ACTION, resource: { type: 'data-subject', id: patientId } },
    offsetPage({ offset: 0, limit: 10, sort: [{ field: 'sequence', direction: 'asc' }] }),
  );

  return page.items;
}
