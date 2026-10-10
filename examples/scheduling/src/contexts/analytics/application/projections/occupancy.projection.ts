import { Criteria, cursorPage, scoped, stampOf, type EventStamp, type IntegrationEvent, type ReadModelWrite } from '@ddd-ts-kit/kernel';
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
} from '../../../scheduling/published-language/index.js';
import { storableStamp } from '../../../../shared-kernel/storable-stamp.js';
import { OccupancyMeasureService, type OutcomeState } from '../../domain/services/occupancy-measure.service.js';
import { OccupancyRegister } from '../ports/occupancy-register.port.js';
import { OutcomeRegister, type Outcome } from '../ports/outcome-register.port.js';

/** What every fact scheduling announces of an appointment says of it. */
type Announced = {
  readonly appointmentId: string;
  readonly calendarId: string;
  readonly practiceId: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly day: string;
};

/** A calendar on a day: what one line of occupancy measures. */
type Place = {
  readonly practiceId: string;
  readonly calendarId: string;
  readonly day: string;
};

const measure = new OccupancyMeasureService();

/**
 * Keeps the occupancy of each calendar and day, counted again from the outcomes every time one
 * of them changes. The outcome the fact sets is counted whether or not the outcomes were
 * written first: the two projections are delivered each fact in no given order. A fact that
 * comes after a later one of the same calendar and day is stale here and writes nothing: the
 * nightly verification counts that day again.
 */
@Projection('analytics.occupancy', [OccupancyRegister, OutcomeRegister])
export class OccupancyProjection {
  constructor(
    private readonly occupancy: OccupancyRegister,
    private readonly outcomes: OutcomeRegister,
  ) {}

  @On(appointmentBookedV1)
  async booked(event: AppointmentBookedV1): Promise<ReadModelWrite> {
    return this.recount(event, 'held');
  }

  @On(appointmentConfirmedV1)
  async confirmed(event: AppointmentConfirmedV1): Promise<ReadModelWrite> {
    return this.recount(event, 'held');
  }

  @On(appointmentRescheduledV1)
  async rescheduled(event: AppointmentRescheduledV1): Promise<ReadModelWrite> {
    const { practiceId, calendarId, day, previousDay } = event.payload;

    if (previousDay !== day) await this.count({ practiceId, calendarId, day: previousDay }, await this.standing(event, 'held'), storableStamp(stampOf(event)));

    return this.recount(event, 'held');
  }

  @On(appointmentCancelledV1)
  async cancelled(event: AppointmentCancelledV1): Promise<ReadModelWrite> {
    return this.recount(event, event.payload.cancelledBy === 'patient' ? 'cancelled-by-patient' : 'cancelled-by-practice');
  }

  @On(appointmentExpiredV1)
  async expired(event: AppointmentExpiredV1): Promise<ReadModelWrite> {
    return this.recount(event, 'expired');
  }

  @On(appointmentCompletedV1)
  async completed(event: AppointmentCompletedV1): Promise<ReadModelWrite> {
    return this.recount(event, 'completed');
  }

  @On(appointmentMarkedNoShowV1)
  async markedNoShow(event: AppointmentMarkedNoShowV1): Promise<ReadModelWrite> {
    return this.recount(event, 'no-show');
  }

  private async recount(event: IntegrationEvent<Announced>, state: OutcomeState): Promise<ReadModelWrite> {
    const { practiceId, calendarId, day } = event.payload;

    return this.count({ practiceId, calendarId, day }, await this.standing(event, state), storableStamp(stampOf(event)));
  }

  /** How the appointment stands once the fact is known: what the fact sets, unless the outcomes already hold a later one. */
  private async standing(event: IntegrationEvent<Announced>, state: OutcomeState): Promise<Outcome> {
    const { appointmentId, calendarId, practiceId, startsAt, endsAt, day } = event.payload;
    const changedAt = new Date(event.occurredAt);
    const known = await this.outcomes.get(appointmentId);

    if (known !== undefined && known.changedAt.getTime() > changedAt.getTime()) return known;

    return { id: appointmentId, practiceId, calendarId, day, startsAt: new Date(startsAt), endsAt: new Date(endsAt), state, changedAt };
  }

  private async count(place: Place, standing: Outcome, stamp: EventStamp): Promise<ReadModelWrite> {
    const others = (await this.outcomesOn(place)).filter((outcome) => outcome.id !== standing.id);
    const counted = standing.calendarId === place.calendarId && standing.day === place.day ? [...others, standing] : others;
    const id = `${place.calendarId}.${place.day}`;

    return this.occupancy.upsertIfNewer(id, stamp, () => ({ id, ...place, ...measure.measure(counted) }));
  }

  private async outcomesOn(place: Place): Promise<readonly Outcome[]> {
    const criteria = Criteria.of<Outcome>().where('calendarId', 'eq', place.calendarId).where('day', 'eq', place.day);
    const found: Outcome[] = [];
    let cursor: string | undefined;

    do {
      const page = await this.outcomes.list(scoped(criteria.page(cursorPage(cursor === undefined ? { limit: 100 } : { cursor, limit: 100 })), { kind: 'all' }));

      found.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor !== undefined);

    return found;
  }
}
