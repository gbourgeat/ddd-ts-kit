import {
  EventSerializer,
  EventSourcedRepository,
  EventStore,
  PersonalDataCipher,
  SnapshotStore,
} from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import {
  AttendanceRecord,
  type AttendanceRecordEvent,
  type AttendanceRecordState,
} from '@/contexts/scheduling/calendars/domain/aggregates/attendance-record.aggregate';
import { AttendanceRecordRepository } from '@/contexts/scheduling/calendars/domain/repositories/attendance-record.repository';
import { attendanceRecordEvents } from '@/contexts/scheduling/calendars/infrastructure/persistence/attendance-record-events.mapper';
import { attendanceRecordSnapshots } from '@/contexts/scheduling/calendars/infrastructure/persistence/attendance-record-snapshots.mapper';

/** The stream of a record is `scheduling.attendance-record-<id>`; a snapshot every 20 events spares a long replay. */
const SNAPSHOT_EVERY = 20;

@Repository(AttendanceRecordRepository)
export class EventStoreAttendanceRecordRepository implements AttendanceRecordRepository {
  private readonly streams: EventSourcedRepository<AttendanceRecord, AttendanceRecordEvent, AttendanceRecordState>;

  constructor(store: EventStore, snapshots: SnapshotStore, cipher: PersonalDataCipher) {
    this.streams = new EventSourcedRepository({
      store,
      category: 'scheduling.attendance-record',
      serializer: new EventSerializer<AttendanceRecordEvent>(attendanceRecordEvents, { cipher }),
      rehydrate: (id, history) => AttendanceRecord.rehydrate(id, history),
      snapshots: { ...attendanceRecordSnapshots, store: snapshots, every: SNAPSHOT_EVERY },
    });
  }

  findById(id: string): Promise<AttendanceRecord | undefined> {
    return this.streams.findById(id);
  }

  save(record: AttendanceRecord): Promise<void> {
    return this.streams.save(record);
  }
}
