import { stampOf, storedStampOf, type DomainEvent, type ReadModelWrite } from '@ddd-ts-kit/kernel';
import { On, Projection } from '@ddd-ts-kit/kernel/declarations';
import { AttendanceRecordCancellationNoted } from '@/contexts/scheduling/domain/events/attendance-record-cancellation-noted.event';
import { AttendanceRecordCreated } from '@/contexts/scheduling/domain/events/attendance-record-created.event';
import { AttendanceRecordNoShowNoted } from '@/contexts/scheduling/domain/events/attendance-record-no-show-noted.event';
import { AttendanceFact } from '@/contexts/scheduling/domain/vocabularies/attendance-fact.vocabulary';
import type {
  AttendanceEntry,
  AttendanceHistory,
} from '@/contexts/scheduling/application/ports/attendance-history.port';

type Fact = Omit<AttendanceEntry, 'id' | 'recordId' | 'version' | 'notedAt'>;

/**
 * Keeps the history of each attendance record, one entry per fact, from the event store: a
 * catch-up subscription under its name applies it, and it is rebuilt from position zero by
 * replaying the store. Each entry is stamped with the version of its stream, so an event applied
 * twice changes nothing.
 */
@Projection('scheduling.attendance-history', { feed: 'event-store' })
export class AttendanceHistoryProjection {
  constructor(private readonly history: AttendanceHistory) {}

  @On(AttendanceRecordCreated, { name: AttendanceRecordCreated.eventName })
  async created(event: AttendanceRecordCreated): Promise<ReadModelWrite> {
    return this.noted(event, { fact: AttendanceFact.Opened, appointmentId: null, startsAt: null, reason: null });
  }

  @On(AttendanceRecordNoShowNoted, { name: AttendanceRecordNoShowNoted.eventName })
  async noShowNoted(event: AttendanceRecordNoShowNoted): Promise<ReadModelWrite> {
    const { appointmentId, startsAt } = event.missed;

    return this.noted(event, { fact: AttendanceFact.NoShow, appointmentId, startsAt, reason: null });
  }

  @On(AttendanceRecordCancellationNoted, { name: AttendanceRecordCancellationNoted.eventName })
  async cancellationNoted(event: AttendanceRecordCancellationNoted): Promise<ReadModelWrite> {
    const { appointmentId, startsAt, reason } = event.cancelled;

    return this.noted(event, { fact: AttendanceFact.Cancellation, appointmentId, startsAt, reason: reason ?? null });
  }

  private noted(event: DomainEvent, fact: Fact): Promise<ReadModelWrite> {
    const stamp = storedStampOf(event) ?? stampOf(event);
    const version = stamp.version ?? 0;
    const id = `${event.aggregateId}#${version}`;

    return this.history.upsertIfNewer(id, stamp, () => ({
      id,
      recordId: event.aggregateId,
      version,
      ...fact,
      notedAt: event.occurredAt,
    }));
  }
}
