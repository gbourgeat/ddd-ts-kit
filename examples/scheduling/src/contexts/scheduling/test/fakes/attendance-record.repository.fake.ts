import {
  InMemoryEventStore,
  InMemorySnapshotStore,
  InMemorySubjectKeyStore,
  PersonalDataCipher,
} from '@ddd-ts-kit/kernel';
import type { AttendanceRecord } from '@/contexts/scheduling/domain/aggregates/attendance-record.aggregate';
import type { AttendanceRecordRepository } from '@/contexts/scheduling/domain/repositories/attendance-record.repository';
import { EventStoreAttendanceRecordRepository } from '@/contexts/scheduling/infrastructure/persistence/event-store-attendance-record.repository';

/** The adapter itself over the in-memory stores of the kernel: what a handler spec saves to, events and all. */
export class FakeAttendanceRecordRepository implements AttendanceRecordRepository {
  readonly store = new InMemoryEventStore();

  private readonly adapter = new EventStoreAttendanceRecordRepository(
    this.store,
    new InMemorySnapshotStore(),
    new PersonalDataCipher(new InMemorySubjectKeyStore()),
  );

  findById(id: string): Promise<AttendanceRecord | undefined> {
    return this.adapter.findById(id);
  }

  save(record: AttendanceRecord): Promise<void> {
    return this.adapter.save(record);
  }
}
