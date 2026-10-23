import type { Page } from '@ddd-ts-kit/kernel';
import type { AttendanceEntry } from '@/contexts/scheduling/application/calendars/ports/attendance-history.port';

export type SearchAttendanceHistoryResult = Page<AttendanceEntry>;
