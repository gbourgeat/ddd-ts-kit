import type { Application as Container } from '@ddd-ts-kit/di';
import { CatchUpSubscription, EventSerializer, PersonalDataCipher } from '@ddd-ts-kit/kernel';
import { applyingProjection } from '@ddd-ts-kit/kernel/declarations';
import type { Persistence } from '@/platform/database/persistence';
import type { AttendanceRecordEvent } from '@/contexts/scheduling/domain/aggregates/attendance-record.aggregate';
import { AttendanceHistoryProjection } from '@/contexts/scheduling/application/projections/attendance-history.projection';
import { attendanceRecordEvents } from '@/contexts/scheduling/infrastructure/persistence/attendance-record-events.mapper';

/**
 * The catch-up subscription of each projection declared `{ feed: 'event-store' }`: under its name,
 * from the store of the event-sourced aggregates, the batch and its checkpoint in one unit of work.
 */
export function storeFedProjections(container: Container, persistence: Persistence): CatchUpSubscription[] {
  const { events, checkpoints } = persistence.eventSourcing;
  const cipher = container.resolve(PersonalDataCipher);

  return [
    new CatchUpSubscription({
      name: 'scheduling.attendance-history',
      store: events,
      checkpoints,
      unitOfWork: persistence.unitOfWork,
      apply: applyingProjection(
        container.resolve(AttendanceHistoryProjection),
        new EventSerializer<AttendanceRecordEvent>(attendanceRecordEvents, { cipher }),
      ),
    }),
  ];
}
