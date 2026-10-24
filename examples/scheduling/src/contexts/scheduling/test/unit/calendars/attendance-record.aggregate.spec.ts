import { describe, expect, it } from 'vitest';
import { expectSnapshotEquivalence, givenEvents } from '@ddd-ts-kit/testing';
import {
  AttendanceRecord,
  type AttendanceRecordEvent,
} from '@/contexts/scheduling/calendars/domain/aggregates/attendance-record.aggregate';
import { AttendanceRecordCancellationNoted } from '@/contexts/scheduling/calendars/domain/events/attendance-record-cancellation-noted.event';
import { AttendanceRecordCreated } from '@/contexts/scheduling/calendars/domain/events/attendance-record-created.event';
import { AttendanceRecordNoShowNoted } from '@/contexts/scheduling/calendars/domain/events/attendance-record-no-show-noted.event';
import { attendanceRecordSnapshots } from '@/contexts/scheduling/calendars/infrastructure/persistence/attendance-record-snapshots.mapper';
import { anAttendanceRecord } from '@/contexts/scheduling/test/builders/attendance-record.builder';

const ID = 'practice-1.patient-1';
const bornAt = new Date('2026-03-01T00:00:00.000Z');
const now = new Date('2026-03-09T10:00:00.000Z');
const created = new AttendanceRecordCreated(ID, bornAt, { practiceId: 'practice-1', patientId: 'patient-1' });

describe('AttendanceRecord', () => {
  it('is born for one patient of one practice, under the identifier of that pair', () => {
    const record = AttendanceRecord.create({ practiceId: 'practice-1', patientId: 'patient-1' }, bornAt);

    expect(record.id).toBe(ID);
    expect(record.registeredAt).toEqual(bornAt);
    expect(record.pullEvents()).toEqual([created]);
  });

  it('starts with nothing noted and nothing missed', () => {
    const record = AttendanceRecord.create({ practiceId: 'practice-1', patientId: 'patient-1' }, bornAt);

    expect(record.toState()).toEqual({
      registeredAt: bornAt,
      practiceId: 'practice-1',
      patientId: 'patient-1',
      noted: [],
      missed: 0,
    });
  });

  it('writes the practice before the patient in its identifier, the dots and percent signs of the practice escaped', () => {
    expect(AttendanceRecord.idOf('practice.1', 'patient-1')).toBe('practice%2E1.patient-1');
    expect(AttendanceRecord.idOf('50%', 'patient-1')).toBe('50%25.patient-1');
  });

  it('never gives two pairs of practice and patient the same identifier, even with a dot in an identifier', () => {
    expect(AttendanceRecord.idOf('practice.1', 'patient')).not.toBe(AttendanceRecord.idOf('practice', '1.patient'));
    expect(AttendanceRecord.idOf('practice%2E1', 'patient')).not.toBe(AttendanceRecord.idOf('practice.1', 'patient'));
  });

  it('notes a no-show and counts it as missed', () => {
    givenEvents(rehydrate, [created, missed('appointment-1', 2)])
      .when((record) => record.noteNoShow({ appointmentId: 'appointment-2', startsAt: bornAt }, now))
      .thenEvents([AttendanceRecordNoShowNoted])
      .thenState((record) => expect(record.missed).toBe(2));
  });

  it('notes a cancellation of the patient with their words, and counts it as missed', () => {
    givenEvents(rehydrate, [created])
      .when((record) =>
        record.noteCancellation({ appointmentId: 'appointment-1', startsAt: bornAt, reason: 'Flu' }, now),
      )
      .thenEvents([
        {
          name: 'scheduling.attendance-record.cancellation-noted',
          aggregateId: ID,
          cancelled: { patientId: 'patient-1', appointmentId: 'appointment-1', startsAt: bornAt, reason: 'Flu' },
        },
      ])
      .thenState((record) => expect(record.missed).toBe(1));
  });

  it('refuses to note an appointment twice, whatever the first fact was', () => {
    givenEvents(rehydrate, [created, missed('appointment-1', 2)])
      .when((record) =>
        record.noteCancellation({ appointmentId: 'appointment-1', startsAt: bornAt, reason: undefined }, now),
      )
      .thenError('ALREADY_NOTED', { appointmentId: 'appointment-1' });
  });

  it('is rebuilt from its history at the version of its stream, recording nothing', () => {
    const record = anAttendanceRecord().ofPatient('patient-9').missed('appointment-1').missed('appointment-2').build();

    expect(record.version).toBe(3);
    expect(record.missed).toBe(2);
    expect(record.pullEvents()).toEqual([]);
  });

  it('keeps the appointments it noted, in the order they were, in its state', () => {
    const record = anAttendanceRecord().missed('appointment-1').missed('appointment-2').build();

    expect(record.toState().noted).toEqual(['appointment-1', 'appointment-2']);
  });

  it('gives the same state rebuilt from any of its snapshots as from its whole history', () => {
    const history: AttendanceRecordEvent[] = [
      created,
      missed('appointment-1', 2),
      new AttendanceRecordCancellationNoted(ID, new Date(Date.UTC(2026, 2, 3)), {
        patientId: 'patient-1',
        appointmentId: 'appointment-2',
        startsAt: new Date(Date.UTC(2026, 2, 4)),
        reason: 'Away',
      }),
      missed('appointment-3', 5),
    ];

    expectSnapshotEquivalence({
      events: history,
      rehydrate,
      policy: attendanceRecordSnapshots,
      state: (record) => record.toState(),
    });
  });
});

function missed(appointmentId: string, day: number): AttendanceRecordNoShowNoted {
  return new AttendanceRecordNoShowNoted(ID, new Date(Date.UTC(2026, 2, day, 10)), {
    appointmentId,
    startsAt: new Date(Date.UTC(2026, 2, day, 9)),
  });
}

function rehydrate(id: string, history: Parameters<typeof AttendanceRecord.rehydrate>[1]): AttendanceRecord {
  return AttendanceRecord.rehydrate(id, history);
}
