import { stampOf, type DomainEvent, type EventStamp, type ReadModelWrite } from '@ddd-ts-kit/kernel';
import { On, Projection } from '@ddd-ts-kit/kernel/declarations';
import { AppointmentAnnotated } from '@/contexts/scheduling/domain/events/appointment-annotated.event';
import { AppointmentBooked } from '@/contexts/scheduling/domain/events/appointment-booked.event';
import { AppointmentCancelled } from '@/contexts/scheduling/domain/events/appointment-cancelled.event';
import { AppointmentCompleted } from '@/contexts/scheduling/domain/events/appointment-completed.event';
import { AppointmentConfirmed } from '@/contexts/scheduling/domain/events/appointment-confirmed.event';
import { AppointmentExpired } from '@/contexts/scheduling/domain/events/appointment-expired.event';
import { AppointmentMarkedNoShow } from '@/contexts/scheduling/domain/events/appointment-marked-no-show.event';
import { AppointmentRescheduled } from '@/contexts/scheduling/domain/events/appointment-rescheduled.event';
import type { Booking } from '@/contexts/scheduling/domain/value-objects/booking.vo';
import { storableStamp } from '@/shared-kernel/storable-stamp';
import type { Agenda, AgendaEntry } from '@/contexts/scheduling/application/ports/agenda.port';

/** Where a fact comes in the life of an appointment, for two facts of the same millisecond: an end is always the last word. */
const RANK: Readonly<Record<string, number>> = {
  'scheduling.appointment.booked': 0,
  'scheduling.appointment.confirmed': 1,
  'scheduling.appointment.rescheduled': 2,
  'scheduling.appointment.annotated': 3,
};

const LAST_RANK = 9;

type Standing = Pick<AgendaEntry, 'status'> & Partial<Pick<AgendaEntry, 'confirmBefore' | 'cancelledBy'>>;

/**
 * Keeps the agenda from the facts of the appointments of this context. Every fact but a move
 * carries the whole entry it leaves, so a fact applied twice or late ends on the same entry;
 * a move changes the place and keeps where the appointment stands.
 */
@Projection('scheduling.agenda')
export class AgendaProjection {
  constructor(private readonly agenda: Agenda) {}

  @On(AppointmentBooked, { name: 'scheduling.appointment.booked' })
  async booked(event: AppointmentBooked): Promise<ReadModelWrite> {
    const { booking, confirmBefore } = event.held;

    return this.stands(
      event,
      booking,
      confirmBefore === undefined ? { status: 'booked' } : { status: 'requested', confirmBefore },
    );
  }

  @On(AppointmentConfirmed, { name: 'scheduling.appointment.confirmed' })
  async confirmed(event: AppointmentConfirmed): Promise<ReadModelWrite> {
    return this.stands(event, event.booking, { status: 'booked' });
  }

  @On(AppointmentRescheduled, { name: 'scheduling.appointment.rescheduled' })
  async rescheduled(event: AppointmentRescheduled): Promise<ReadModelWrite> {
    return this.agenda.upsertIfNewer(event.aggregateId, stampOfFact(event), (current) =>
      current === undefined ? undefined : { ...current, ...placeOf(event.moved.booking), changedAt: event.occurredAt },
    );
  }

  @On(AppointmentAnnotated, { name: 'scheduling.appointment.annotated' })
  async annotated(event: AppointmentAnnotated): Promise<ReadModelWrite> {
    return this.agenda.upsertIfNewer(event.aggregateId, stampOfFact(event), (current) =>
      current === undefined ? undefined : { ...current, internalNote: event.internalNote, changedAt: event.occurredAt },
    );
  }

  @On(AppointmentCancelled, { name: 'scheduling.appointment.cancelled' })
  async cancelled(event: AppointmentCancelled): Promise<ReadModelWrite> {
    return this.stands(event, event.ended.booking, { status: 'cancelled', cancelledBy: event.ended.cancellation.by });
  }

  @On(AppointmentExpired, { name: 'scheduling.appointment.expired' })
  async expired(event: AppointmentExpired): Promise<ReadModelWrite> {
    return this.stands(event, event.booking, { status: 'expired' });
  }

  @On(AppointmentCompleted, { name: 'scheduling.appointment.completed' })
  async completed(event: AppointmentCompleted): Promise<ReadModelWrite> {
    return this.stands(event, event.booking, { status: 'completed' });
  }

  @On(AppointmentMarkedNoShow, { name: 'scheduling.appointment.marked-no-show' })
  async markedNoShow(event: AppointmentMarkedNoShow): Promise<ReadModelWrite> {
    return this.stands(event, event.booking, { status: 'no-show' });
  }

  private async stands(event: DomainEvent, booking: Booking, standing: Standing): Promise<ReadModelWrite> {
    const entry: Omit<AgendaEntry, 'internalNote'> = {
      ...placeOf(booking),
      id: event.aggregateId,
      confirmBefore: null,
      cancelledBy: null,
      ...standing,
      changedAt: event.occurredAt,
    };

    // The note is the staff's, and no fact of the standing says it again: it is kept from the entry.
    return this.agenda.upsertIfNewer(event.aggregateId, stampOfFact(event), (current) => ({
      ...entry,
      internalNote: current?.internalNote ?? null,
    }));
  }
}

function placeOf(
  booking: Booking,
): Omit<AgendaEntry, 'id' | 'status' | 'confirmBefore' | 'cancelledBy' | 'internalNote' | 'changedAt'> {
  return {
    calendarId: booking.calendarId,
    practiceId: booking.practiceId,
    practitionerId: booking.practitionerId,
    patientId: booking.patientId,
    appointmentTypeId: booking.appointmentTypeId,
    startsAt: booking.slot.startsAt,
    endsAt: booking.slot.endsAt,
    heldUntil: booking.slot.heldUntil,
    day: booking.day,
  };
}

/**
 * The stamp of a fact of an appointment, as the store can keep it (`storableStamp`). Every fact
 * of an entry comes from the one appointment, so the versions of an entry are one stream: the
 * millisecond of the fact, then its rank.
 */
function stampOfFact(event: DomainEvent): EventStamp {
  return storableStamp(stampOf(event), RANK[event.name] ?? LAST_RANK);
}
