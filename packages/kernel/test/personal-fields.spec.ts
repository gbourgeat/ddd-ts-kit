import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import {
  ERASED_PERSONAL_DATA,
  InMemoryFileStorage,
  InMemoryPersonalData,
  InvalidPersonalFieldsError,
  personalDataValueOf,
  personalFields,
} from '../src';

interface AppointmentRow {
  readonly id: string;
  readonly patient_id: string;
  readonly internal_note: string | null;
  readonly weight_kg: number | null;
  readonly document_key: string | null;
  readonly starts_at: Date;
}

const APPOINTMENTS = { schema: 'scheduling', table: 'appointments' };

const pseudonymised = personalFields<AppointmentRow, typeof APPOINTMENTS>(APPOINTMENTS, {
  subject: 'patient_id',
  fields: ['internal_note', 'weight_kg'],
  files: ['document_key'],
  erasure: 'pseudonymise',
});

describe('personalFields', () => {
  it('declares the table, the subject column, the personal columns, the mode and the file columns', () => {
    expect(pseudonymised).toEqual({
      table: APPOINTMENTS,
      subject: 'patient_id',
      fields: ['internal_note', 'weight_kg'],
      files: ['document_key'],
      erasure: 'pseudonymise',
    });

    expect(
      personalFields<AppointmentRow>(APPOINTMENTS, { subject: 'patient_id', fields: ['internal_note'], erasure: 'row' })
        .files,
    ).toEqual([]);
  });

  it('refuses a declaration without a personal field, one that lists a column twice, and a subject declared personal', () => {
    expect(() =>
      personalFields<AppointmentRow>(APPOINTMENTS, { subject: 'patient_id', fields: [], erasure: 'row' }),
    ).toThrow(InvalidPersonalFieldsError);

    expect(() =>
      personalFields<AppointmentRow>(APPOINTMENTS, {
        subject: 'patient_id',
        fields: ['internal_note', 'internal_note'],
        erasure: 'row',
      }),
    ).toThrow('lists a column twice');

    expect(() =>
      personalFields<AppointmentRow>(APPOINTMENTS, { subject: 'patient_id', fields: ['patient_id'], erasure: 'row' }),
    ).toThrow('names its subject column "patient_id" as personal data');
  });
});

describe('InMemoryPersonalData', () => {
  it('pseudonymises the rows of the subject: a text reads erased, another type reads nothing, a file is deleted and forgotten', async () => {
    const files = new InMemoryFileStorage();

    const referral = await files.put('tenants/acme/documents/referral', Readable.from([Buffer.from('%PDF')]), {
      mediaType: 'application/pdf',
    });

    const table = new InMemoryPersonalData('scheduling.appointments', pseudonymised, { files });
    const startsAt = new Date('2026-03-02T09:00:00.000Z');

    table.insert(
      {
        id: 'visit-1',
        patient_id: 'ada',
        internal_note: 'Allergic to penicillin',
        weight_kg: 62,
        document_key: referral.key,
        starts_at: startsAt,
      },
      {
        id: 'visit-2',
        patient_id: 'bob',
        internal_note: 'Prefers mornings',
        weight_kg: null,
        document_key: null,
        starts_at: startsAt,
      },
    );

    expect(await table.erase('ada')).toBe(1);

    expect(table.all()).toEqual([
      {
        id: 'visit-1',
        patient_id: 'ada',
        internal_note: ERASED_PERSONAL_DATA,
        weight_kg: null,
        document_key: null,
        starts_at: startsAt,
      },
      {
        id: 'visit-2',
        patient_id: 'bob',
        internal_note: 'Prefers mornings',
        weight_kg: null,
        document_key: null,
        starts_at: startsAt,
      },
    ]);

    expect(await files.stat(referral.key)).toBeUndefined();
    expect(await table.erase('ada')).toBe(0);
  });

  it('counts a row whose fields read erased already but which still names a file', async () => {
    const table = new InMemoryPersonalData('scheduling.appointments', pseudonymised);
    const startsAt = new Date('2026-03-02T09:00:00.000Z');

    table.insert({
      id: 'visit-1',
      patient_id: 'ada',
      internal_note: ERASED_PERSONAL_DATA,
      weight_kg: null,
      document_key: 'left-over',
      starts_at: startsAt,
    });

    expect(await table.erase('ada')).toBe(1);
    expect(table.all()[0]?.document_key).toBeNull();
  });

  it('deletes the rows of the subject under the row mode, and exports what they held before', async () => {
    const persons = personalFields<{ id: string; display_name: string; email: string; registered_at: Date }>(
      'persons',
      {
        subject: 'id',
        fields: ['display_name', 'email'],
        erasure: 'row',
      },
    );

    const table = new InMemoryPersonalData('identity.persons', persons);
    const registeredAt = new Date('2026-01-01T00:00:00.000Z');

    table.insert(
      { id: 'ada', display_name: 'Ada Lovelace', email: 'ada@example.org', registered_at: registeredAt },
      { id: 'bob', display_name: 'Bob Hope', email: 'bob@example.org', registered_at: registeredAt },
    );

    expect(await table.exportOf('ada')).toEqual([
      { source: 'identity.persons', values: { display_name: 'Ada Lovelace', email: 'ada@example.org' } },
    ]);

    expect(await table.erase('ada')).toBe(1);
    expect(table.all().map((row) => row.id)).toEqual(['bob']);
    expect(await table.exportOf('ada')).toEqual([]);
  });

  it('exports an instant as ISO text, a scalar as it is, nothing as null and anything else as JSON text', () => {
    expect([
      personalDataValueOf(new Date('2026-03-02T09:00:00.000Z')),
      personalDataValueOf('Ada'),
      personalDataValueOf(62),
      personalDataValueOf(true),
      personalDataValueOf(null),
      personalDataValueOf(undefined),
      personalDataValueOf({ city: 'Lyon' }),
    ]).toEqual(['2026-03-02T09:00:00.000Z', 'Ada', 62, true, null, null, '{"city":"Lyon"}']);
  });
});
