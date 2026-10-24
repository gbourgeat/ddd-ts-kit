import { Readable } from 'node:stream';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { anExecutionContext } from '@ddd-ts-kit/testing';
import {
  ERASED_PERSONAL_DATA,
  FixedClock,
  FixedExecutionScope,
  InMemoryFileStorage,
  type EventStamp,
} from '@ddd-ts-kit/kernel';
import { AttachedDocument } from '@/contexts/scheduling/calendars/domain/value-objects/attached-document.vo';
import { Cancellation } from '@/contexts/scheduling/calendars/domain/value-objects/cancellation.vo';
import { KnexAppointmentRepository } from '@/contexts/scheduling/calendars/infrastructure/persistence/knex-appointment.repository';
import { KnexPatientErasure } from '@/contexts/scheduling/calendars/infrastructure/persistence/knex-patient-erasure.repository';
import { KnexPractitionerDirectory } from '@/contexts/scheduling/calendars/infrastructure/persistence/knex-practitioner-directory.repository';
import { storableStamp } from '@/shared-kernel/storable-stamp';
import { openTestDatabase, type TestDatabase } from '@/platform/database/open-test-database';
import { anAppointment } from '@/contexts/scheduling/test/builders/appointment.builder';

const NOW = new Date('2026-02-01T09:00:00.000Z');
const PDF = '%PDF-1.7\n%%EOF\n';

/** The work of these specs runs in one network at a time: every table here holds tenant data. */
const north = new FixedExecutionScope(anExecutionContext().ofTenant('north').build());
const south = new FixedExecutionScope(anExecutionContext().ofTenant('south').build());
const clock = new FixedClock(NOW);

let database: TestDatabase;
let files: InMemoryFileStorage;
let erasure: KnexPatientErasure;
let appointments: KnexAppointmentRepository;
let practitioners: KnexPractitionerDirectory;

beforeAll(async () => {
  database = await openTestDatabase();
});

afterAll(async () => {
  await database.close();
});

beforeEach(async () => {
  await database.reset();
  files = new InMemoryFileStorage();

  const { database: context } = database.persistence;

  erasure = new KnexPatientErasure(context, north, files);
  appointments = new KnexAppointmentRepository(context, north, clock);
  practitioners = new KnexPractitionerDirectory(context, north);
});

describe('KnexPatientErasure', () => {
  it('replaces the notes and the cancellation reasons of the patient, deletes their documents and the copied name, and counts the rows', async () => {
    const referral = await aStoredFile('tenants/north/appointment-documents/referral');
    const noted = anAppointment().identifiedBy('visit-1').forPatient('ada').build();
    const cancelled = anAppointment().identifiedBy('visit-2').forPatient('ada').build();

    noted.annotate('Allergic to penicillin', NOW);
    noted.attachDocument(AttachedDocument.create(referral, 'referral.pdf', NOW), NOW);
    cancelled.cancel(Cancellation.create('patient', 'Moving abroad'), NOW);
    await appointments.save(noted);
    await appointments.save(cancelled);
    await practitioners.upsertIfNewer('practice-1.ada', stamp('member-1'), () => practitionerOf('ada', 'Ada Lovelace'));

    expect(await erasure.erase('ada')).toBe(4);

    const [afterNote, afterCancellation] = [
      await appointments.findById('visit-1'),
      await appointments.findById('visit-2'),
    ];

    expect(afterNote?.internalNote).toBe(ERASED_PERSONAL_DATA);
    expect(afterNote?.document).toBeUndefined();
    expect(await files.stat(referral.key)).toBeUndefined();
    expect(afterCancellation?.toState().cancellation).toEqual(Cancellation.create('patient', ERASED_PERSONAL_DATA));
    expect((await practitioners.get('practice-1.ada'))?.displayName).toBe(ERASED_PERSONAL_DATA);
  });

  it('reaches nothing the second time, and nothing of anyone else or of another network', async () => {
    const mine = anAppointment().identifiedBy('visit-1').forPatient('ada').build();
    const theirs = anAppointment().identifiedBy('visit-2').forPatient('bob').build();
    const elsewhere = anAppointment().identifiedBy('visit-3').forPatient('ada').build();

    mine.annotate('Allergic to penicillin', NOW);
    theirs.annotate('Prefers mornings', NOW);
    elsewhere.annotate('Known in the south', NOW);
    await appointments.save(mine);
    await appointments.save(theirs);
    await new KnexAppointmentRepository(database.persistence.database, south, clock).save(elsewhere);

    expect(await erasure.erase('ada')).toBe(1);
    expect(await erasure.erase('ada')).toBe(0);

    expect((await appointments.findById('visit-2'))?.internalNote).toBe('Prefers mornings');

    const inTheSouth = new KnexAppointmentRepository(database.persistence.database, south, clock);

    expect((await inTheSouth.findById('visit-3'))?.internalNote).toBe('Known in the south');
  });

  it('forgets a document whose file is already gone: the row is run again, the file is not an error', async () => {
    const referral = await aStoredFile('tenants/north/appointment-documents/gone');
    const noted = anAppointment().identifiedBy('visit-1').forPatient('ada').build();

    noted.attachDocument(AttachedDocument.create(referral, 'referral.pdf', NOW), NOW);
    await appointments.save(noted);
    await files.delete(referral.key);

    expect(await erasure.erase('ada')).toBe(1);
    expect((await appointments.findById('visit-1'))?.document).toBeUndefined();
  });
});

function aStoredFile(key: string) {
  return files.put(key, Readable.from([Buffer.from(PDF)]), { mediaType: 'application/pdf' });
}

function practitionerOf(personId: string, displayName: string) {
  return {
    id: `practice-1.${personId}`,
    practiceId: 'practice-1',
    practitionerId: personId,
    displayName,
    timeZone: 'Europe/Paris',
  };
}

function stamp(eventId: string): EventStamp {
  return storableStamp({ eventId, occurredAt: new Date('2026-01-15T08:00:00.000Z') });
}
