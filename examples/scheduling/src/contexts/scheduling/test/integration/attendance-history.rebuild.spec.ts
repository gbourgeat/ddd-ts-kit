import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  CatchUpSubscription,
  Criteria,
  EventSerializer,
  EventStoreProjectionRebuild,
  PersonalDataCipher,
  scoped,
} from '@ddd-ts-kit/kernel';
import { applyingProjection } from '@ddd-ts-kit/kernel/declarations';
import type { AttendanceEntry } from '@/contexts/scheduling/application/ports/attendance-history.port';
import { AttendanceHistoryProjection } from '@/contexts/scheduling/application/projections/attendance-history.projection';
import {
  AttendanceRecord,
  type AttendanceRecordEvent,
} from '@/contexts/scheduling/domain/aggregates/attendance-record.aggregate';
import { attendanceRecordEvents } from '@/contexts/scheduling/infrastructure/persistence/attendance-record-events.mapper';
import { EventStoreAttendanceRecordRepository } from '@/contexts/scheduling/infrastructure/persistence/event-store-attendance-record.repository';
import { KnexAttendanceHistory } from '@/contexts/scheduling/infrastructure/persistence/knex-attendance-history.repository';
import { openTestDatabase, type TestDatabase } from '@/platform/database/open-test-database';

const at = new Date('2026-03-02T09:00:00.000Z');

let database: TestDatabase;

beforeAll(async () => {
  database = await openTestDatabase();
});

afterAll(async () => {
  await database.close();
});

beforeEach(async () => {
  await database.reset();
});

describe('the attendance history, fed by the event store', () => {
  it('catches up from position zero, moving its checkpoint with what it applied', async () => {
    await noted();

    const { persistence, serializer, history } = parts();

    const read = await new CatchUpSubscription({
      name: 'scheduling.attendance-history',
      store: persistence.eventSourcing.events,
      checkpoints: persistence.eventSourcing.checkpoints,
      unitOfWork: persistence.unitOfWork,
      apply: applyingProjection(new AttendanceHistoryProjection(history), serializer),
    }).catchUp();

    expect(read).toBe(6);
    expect(await persistence.eventSourcing.checkpoints.position('scheduling.attendance-history')).toBe(6);
    expect(await rows(history)).toContain('practice-1.patient-2#3 cancellation Words of patient-2');
  });

  it('is rebuilt from position zero into the same rows, and an erased patient reads erased afterwards', async () => {
    await noted();

    const { persistence, serializer, history } = parts();

    const rebuild = () =>
      new EventStoreProjectionRebuild<AttendanceEntry>({
        table: history.table,
        store: persistence.eventSourcing.events,
        unitOfWork: persistence.unitOfWork,
        applierOn: (copy) => applyingProjection(new AttendanceHistoryProjection(copy), serializer),
      }).run();

    await new CatchUpSubscription({
      name: 'scheduling.attendance-history',
      store: persistence.eventSourcing.events,
      checkpoints: persistence.eventSourcing.checkpoints,
      unitOfWork: persistence.unitOfWork,
      apply: applyingProjection(new AttendanceHistoryProjection(history), serializer),
    }).catchUp();

    const caughtUp = await rows(history);

    expect(await rebuild()).toEqual({ replayed: 6 });
    expect(await rows(history)).toEqual(caughtUp);

    await persistence.eventSourcing.subjectKeys.erase('patient-1');
    await rebuild();

    expect(await rows(history)).toContain('practice-1.patient-1#3 cancellation [erased]');
    expect(await rows(history)).toContain('practice-1.patient-2#3 cancellation Words of patient-2');
  });

  it('keeps the words of a patient sealed in the stream: the store holds no clear text of them', async () => {
    await noted();

    const stored = await database.persistence.eventSourcing.events.readStream(
      'scheduling.attendance-record-practice-1.patient-1',
    );

    expect(JSON.stringify(stored)).not.toContain('Words of patient-1');

    expect(stored.map(({ type }) => type)).toEqual([
      'scheduling.attendance-record.created',
      'scheduling.attendance-record.no-show-noted',
      'scheduling.attendance-record.cancellation-noted',
    ]);
  });
});

/** Two patients of one practice, each with a stream of facts, saved in the unit of work as a command would. */
async function noted(): Promise<void> {
  const { persistence } = database;
  const { events, snapshots, subjectKeys } = persistence.eventSourcing;
  const records = new EventStoreAttendanceRecordRepository(events, snapshots, new PersonalDataCipher(subjectKeys));

  for (const patientId of ['patient-1', 'patient-2']) {
    const record = AttendanceRecord.create({ practiceId: 'practice-1', patientId }, at);

    record.noteNoShow({ appointmentId: `${patientId}-a`, startsAt: at }, at);
    record.noteCancellation({ appointmentId: `${patientId}-b`, startsAt: at, reason: `Words of ${patientId}` }, at);
    await persistence.unitOfWork.run(() => records.save(record));
  }
}

function parts() {
  const { persistence } = database;
  const cipher = new PersonalDataCipher(persistence.eventSourcing.subjectKeys);
  const serializer = new EventSerializer<AttendanceRecordEvent>(attendanceRecordEvents, { cipher });
  const history = new KnexAttendanceHistory(persistence.database);

  return { persistence, serializer, history };
}

async function rows(history: KnexAttendanceHistory): Promise<string[]> {
  const page = await history.search(scoped(Criteria.of<AttendanceEntry>(), { kind: 'all' }));

  return page.items.map(({ id, fact, reason }) => `${id} ${fact} ${reason ?? '-'}`).sort();
}
