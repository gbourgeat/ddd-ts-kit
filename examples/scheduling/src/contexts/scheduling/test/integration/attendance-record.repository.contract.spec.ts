import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PersonalDataCipher } from '@ddd-ts-kit/kernel';
import { repositoryContract } from '@ddd-ts-kit/testing/contracts';
import { AttendanceRecord } from '@/contexts/scheduling/domain/calendars/aggregates/attendance-record.aggregate';
import { EventStoreAttendanceRecordRepository } from '@/contexts/scheduling/infrastructure/persistence/event-store-attendance-record.repository';
import { openTestDatabase, type TestDatabase } from '@/platform/database/open-test-database';
import { FakeAttendanceRecordRepository } from '@/contexts/scheduling/test/fakes/attendance-record.repository.fake';

const runner = { describe, it, expect, beforeEach, afterEach };
const at = new Date('2026-03-02T09:00:00.000Z');
let noted = 0;

const expectations = {
  createAggregate: () => {
    const record = AttendanceRecord.create({ practiceId: 'practice-1', patientId: `patient-${noted}` }, at);

    noted += 1;
    record.noteNoShow({ appointmentId: 'appointment-1', startsAt: at }, at);

    return record;
  },
  mutate: (changed: AttendanceRecord) => {
    noted += 1;
    changed.noteCancellation({ appointmentId: `appointment-${noted + 1}`, startsAt: at, reason: 'Away' }, at);
  },
  idOf: (subject: AttendanceRecord) => subject.id,
  stateOf: (subject: AttendanceRecord) => subject.toState(),
};

repositoryContract<AttendanceRecord>(runner, {
  ...expectations,
  name: 'FakeAttendanceRecordRepository',
  createRepository: () => new FakeAttendanceRecordRepository(),
});

let database: TestDatabase;

beforeAll(async () => {
  database = await openTestDatabase();
});

afterAll(async () => {
  await database.close();
});

repositoryContract<AttendanceRecord>(runner, {
  ...expectations,
  name: 'EventStoreAttendanceRecordRepository on PostgreSQL',
  createRepository: async () => {
    await database.reset();

    const { events, snapshots, subjectKeys } = database.persistence.eventSourcing;

    return new EventStoreAttendanceRecordRepository(events, snapshots, new PersonalDataCipher(subjectKeys));
  },
});
