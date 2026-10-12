import { Repository } from '@ddd-ts-kit/kernel';
import type { AttendanceRecord } from '@/contexts/scheduling/domain/aggregates/attendance-record.aggregate';

/** One record per patient and practice, found by the identifier `AttendanceRecord.idOf` gives. Its adapter keeps its events, not a row. */
export abstract class AttendanceRecordRepository extends Repository<AttendanceRecord> {}
