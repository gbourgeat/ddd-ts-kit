import {
  CatchUpSubscription,
  EventSerializer,
  EventStoreProjectionRebuild,
  type EventStoreRebuildReport,
  type PersonalDataCipher,
} from '@ddd-ts-kit/kernel';
import { applyingProjection } from '@ddd-ts-kit/kernel/declarations';
import type { Persistence } from '@/platform/database/persistence';
import type { AttendanceRecordEvent } from '@/contexts/scheduling/domain/calendars/aggregates/attendance-record.aggregate';
import { AttendanceHistoryProjection } from '@/contexts/scheduling/application/calendars/projections/attendance-history.projection';
import { attendanceRecordEvents } from '@/contexts/scheduling/infrastructure/persistence/attendance-record-events.mapper';
import { KnexAttendanceHistory } from '@/contexts/scheduling/infrastructure/persistence/knex-attendance-history.repository';

/** A projection declared `{ feed: 'event-store' }`: how it catches up, and how it is rebuilt from position zero. */
export interface StoreFedProjection {
  readonly name: string;
  readonly subscription: CatchUpSubscription;
  rebuild(): Promise<EventStoreRebuildReport>;
}

/**
 * Each projection fed by the store of the event-sourced aggregates, under its name: its catch-up
 * subscription (the batch and its checkpoint in one unit of work) and its rebuild, which replays
 * the store into a copy of its table and swaps it in without stopping the subscription.
 */
export function storeFedProjections(persistence: Persistence, cipher: PersonalDataCipher): StoreFedProjection[] {
  const { events, checkpoints } = persistence.eventSourcing;
  const serializer = new EventSerializer<AttendanceRecordEvent>(attendanceRecordEvents, { cipher });
  const history = new KnexAttendanceHistory(persistence.database);
  const name = 'scheduling.attendance-history';

  const rebuild = new EventStoreProjectionRebuild({
    table: history.table,
    store: events,
    unitOfWork: persistence.unitOfWork,
    applierOn: (copy) => applyingProjection(new AttendanceHistoryProjection(copy), serializer),
  });

  const subscription = new CatchUpSubscription({
    name,
    store: events,
    checkpoints,
    unitOfWork: persistence.unitOfWork,
    apply: applyingProjection(new AttendanceHistoryProjection(history), serializer),
  });

  return [{ name, subscription, rebuild: () => rebuild.run() }];
}
