import { describe, expect, it } from 'vitest';
import {
  CatchUpSubscription,
  Criteria,
  EventSerializer,
  EventStoreProjectionRebuild,
  InMemoryCheckpointStore,
  InMemoryEventStore,
  InMemorySnapshotStore,
  InMemorySubjectKeyStore,
  InMemoryUnitOfWork,
  PersonalDataCipher,
  scoped,
} from '@ddd-ts-kit/kernel';
import { applyingProjection } from '@ddd-ts-kit/kernel/declarations';
import type { AttendanceEntry } from '@/contexts/scheduling/calendars/application/ports/attendance-history.port';
import { AttendanceHistoryProjection } from '@/contexts/scheduling/calendars/application/projections/attendance-history.projection';
import {
  AttendanceRecord,
  type AttendanceRecordEvent,
} from '@/contexts/scheduling/calendars/domain/aggregates/attendance-record.aggregate';
import { AttendanceRecordCreated } from '@/contexts/scheduling/calendars/domain/events/attendance-record-created.event';
import { attendanceRecordEvents } from '@/contexts/scheduling/calendars/infrastructure/persistence/attendance-record-events.mapper';
import { EventStoreAttendanceRecordRepository } from '@/contexts/scheduling/calendars/infrastructure/persistence/event-store-attendance-record.repository';
import { FakeAttendanceHistory } from '@/contexts/scheduling/test/fakes/attendance-history.fake';

const at = new Date('2026-03-02T10:00:00.000Z');

describe('AttendanceHistoryProjection', () => {
  it('keeps one entry per fact of a record, in the order of its stream, the words of the patient read back', async () => {
    const { store, serializer, history } = await journal();

    await new CatchUpSubscription({
      name: 'scheduling.attendance-history',
      store,
      checkpoints: new InMemoryCheckpointStore(),
      unitOfWork: new InMemoryUnitOfWork(),
      apply: applyingProjection(new AttendanceHistoryProjection(history), serializer),
    }).catchUp();

    const { items } = await history.search(scoped(Criteria.of<AttendanceEntry>(), { kind: 'all' }));

    expect(lines(items)).toEqual(['1 opened - -', '2 no-show appointment-1 -', '3 cancellation appointment-2 Flu']);
  });

  it('changes nothing when an event is applied twice', async () => {
    const history = new FakeAttendanceHistory();
    const projection = new AttendanceHistoryProjection(history);

    const created = new AttendanceRecordCreated('practice-1.patient-1', at, {
      practiceId: 'practice-1',
      patientId: 'patient-1',
    });

    expect(await projection.created(created)).toBe('applied');
    expect(await projection.created(created)).toBe('stale');
  });

  it('is rebuilt from position zero, and a patient erased since reads erased in the rebuilt history', async () => {
    const { keys, store, serializer, history } = await journal();

    const rebuild = () =>
      new EventStoreProjectionRebuild<AttendanceEntry>({
        table: history.table,
        store,
        unitOfWork: new InMemoryUnitOfWork(),
        applierOn: (copy) => applyingProjection(new AttendanceHistoryProjection(copy), serializer),
      }).run();

    expect(await rebuild()).toEqual({ replayed: 3 });
    expect((await history.get('practice-1.patient-1#3'))?.reason).toBe('Flu');

    await keys.erase('patient-1');

    expect(await rebuild()).toEqual({ replayed: 3 });
    expect((await history.get('practice-1.patient-1#3'))?.reason).toBe('[erased]');
  });
});

async function journal() {
  const keys = new InMemorySubjectKeyStore();
  const cipher = new PersonalDataCipher(keys);
  const store = new InMemoryEventStore();
  const records = new EventStoreAttendanceRecordRepository(store, new InMemorySnapshotStore(), cipher);
  const record = AttendanceRecord.create({ practiceId: 'practice-1', patientId: 'patient-1' }, at);

  record.noteNoShow({ appointmentId: 'appointment-1', startsAt: at }, at);
  record.noteCancellation({ appointmentId: 'appointment-2', startsAt: at, reason: 'Flu' }, at);
  await records.save(record);

  const serializer = new EventSerializer<AttendanceRecordEvent>(attendanceRecordEvents, { cipher });
  const history = new FakeAttendanceHistory();

  return { keys, store, serializer, history };
}

function lines(entries: readonly AttendanceEntry[]): string[] {
  return entries.map(
    ({ version, fact, appointmentId, reason }) => `${version} ${fact} ${appointmentId ?? '-'} ${reason ?? '-'}`,
  );
}
