import { stampOf, type IntegrationEvent, type ReadModelWrite } from '@ddd-ts-kit/kernel';
import { On, Projection } from '@ddd-ts-kit/kernel/declarations';
import {
  appointmentBookedV1,
  appointmentCancelledV1,
  appointmentCompletedV1,
  appointmentConfirmedV1,
  appointmentExpiredV1,
  appointmentMarkedNoShowV1,
  appointmentRescheduledV1,
  type AppointmentBookedV1,
  type AppointmentCancelledV1,
  type AppointmentCompletedV1,
  type AppointmentConfirmedV1,
  type AppointmentExpiredV1,
  type AppointmentMarkedNoShowV1,
  type AppointmentRescheduledV1,
} from '@/contexts/scheduling/published-language/index';
import { storableStamp } from '@/shared-kernel/storable-stamp';
import type { OutcomeState } from '@/contexts/analytics/domain/services/occupancy-measure.service';
import type { OutcomeRegister } from '@/contexts/analytics/application/ports/outcome-register.port';

/** What every fact scheduling announces of an appointment says of it. */
type Announced = {
  readonly appointmentId: string;
  readonly calendarId: string;
  readonly practiceId: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly day: string;
};

/** Keeps the outcome of each appointment: every fact sets the whole line, so a replay or a late delivery ends on the same one. */
@Projection('analytics.outcomes')
export class OutcomesProjection {
  constructor(private readonly outcomes: OutcomeRegister) {}

  @On(appointmentBookedV1)
  async booked(event: AppointmentBookedV1): Promise<ReadModelWrite> {
    return this.set(event, 'held');
  }

  @On(appointmentConfirmedV1)
  async confirmed(event: AppointmentConfirmedV1): Promise<ReadModelWrite> {
    return this.set(event, 'held');
  }

  @On(appointmentRescheduledV1)
  async rescheduled(event: AppointmentRescheduledV1): Promise<ReadModelWrite> {
    return this.set(event, 'held');
  }

  @On(appointmentCancelledV1)
  async cancelled(event: AppointmentCancelledV1): Promise<ReadModelWrite> {
    return this.set(event, event.payload.cancelledBy === 'patient' ? 'cancelled-by-patient' : 'cancelled-by-practice');
  }

  @On(appointmentExpiredV1)
  async expired(event: AppointmentExpiredV1): Promise<ReadModelWrite> {
    return this.set(event, 'expired');
  }

  @On(appointmentCompletedV1)
  async completed(event: AppointmentCompletedV1): Promise<ReadModelWrite> {
    return this.set(event, 'completed');
  }

  @On(appointmentMarkedNoShowV1)
  async markedNoShow(event: AppointmentMarkedNoShowV1): Promise<ReadModelWrite> {
    return this.set(event, 'no-show');
  }

  private set(event: IntegrationEvent<Announced>, state: OutcomeState): Promise<ReadModelWrite> {
    const { appointmentId, calendarId, practiceId, startsAt, endsAt, day } = event.payload;

    return this.outcomes.upsertIfNewer(appointmentId, storableStamp(stampOf(event)), () => ({
      id: appointmentId,
      practiceId,
      calendarId,
      day,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      state,
      changedAt: new Date(event.occurredAt),
    }));
  }
}
