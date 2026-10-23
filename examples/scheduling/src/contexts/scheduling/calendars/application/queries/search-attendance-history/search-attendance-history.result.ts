import type { Page } from '@ddd-ts-kit/kernel';
import type { AttendanceEntry } from '@/contexts/scheduling/calendars/application/ports/attendance-history.port';

export type SearchAttendanceHistoryResult = Page<AttendanceEntry>;
