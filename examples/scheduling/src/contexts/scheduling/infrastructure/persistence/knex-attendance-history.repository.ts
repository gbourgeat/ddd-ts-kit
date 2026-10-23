import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { KnexContext, KnexReadModelStore } from '@ddd-ts-kit/knex';
import {
  AttendanceHistory,
  attendanceHistoryCriteria,
  type AttendanceEntry,
} from '@/contexts/scheduling/application/calendars/ports/attendance-history.port';
import { SCHEDULING_SCHEMA } from '@/contexts/scheduling/infrastructure/persistence/scheduling.schema';

@Repository(AttendanceHistory)
export class KnexAttendanceHistory extends KnexReadModelStore<AttendanceEntry> implements AttendanceHistory {
  constructor(context: KnexContext) {
    // ddd-ts-kit-disable-next-line tenancy/scoped-statement -- ADR-0004: the event store that feeds this history keeps no network yet
    super(context, {
      schema: SCHEDULING_SCHEMA,
      table: 'attendance_history',
      columns: {
        id: 'id',
        recordId: 'record_id',
        version: 'version',
        fact: 'fact',
        appointmentId: 'appointment_id',
        startsAt: 'starts_at',
        reason: 'reason',
        notedAt: 'noted_at',
      },
      definition: attendanceHistoryCriteria,
    });
  }
}
