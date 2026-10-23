import { InMemoryReadModelStore } from '@ddd-ts-kit/kernel';
import {
  attendanceHistoryCriteria,
  type AttendanceEntry,
  type AttendanceHistory,
} from '@/contexts/scheduling/calendars/application/ports/attendance-history.port';

export class FakeAttendanceHistory extends InMemoryReadModelStore<AttendanceEntry> implements AttendanceHistory {
  constructor() {
    super(attendanceHistoryCriteria);
  }
}
