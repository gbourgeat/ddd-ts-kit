import { stampOf, type DomainEvent, type EventStamp, type ReadModelWrite } from '@ddd-ts-kit/kernel';
import { On, Projection } from '@ddd-ts-kit/kernel/declarations';
import { AppointmentBooked } from '../../domain/events/appointment-booked.event.js';
import { AppointmentCancelled } from '../../domain/events/appointment-cancelled.event.js';
import { AppointmentCompleted } from '../../domain/events/appointment-completed.event.js';
import { AppointmentConfirmed } from '../../domain/events/appointment-confirmed.event.js';
import { AppointmentExpired } from '../../domain/events/appointment-expired.event.js';
import { AppointmentMarkedNoShow } from '../../domain/events/appointment-marked-no-show.event.js';
import { AppointmentRescheduled } from '../../domain/events/appointment-rescheduled.event.js';
import type { Booking } from '../../domain/value-objects/booking.vo.js';
import { storableStamp } from '../../../../shared-kernel/storable-stamp.js';
import { Agenda, type AgendaEntry } from '../ports/agenda.port.js';

/** Where a fact comes in the life of an appointment, for two facts of the same millisecond: an end is always the last word. */
const RANK: Readonly<Record<string, number>> = {
  'scheduling.appointment.booked': 0,
  'scheduling.appointment.confirmed': 1,
  'scheduling.appointment.rescheduled': 2,
};

const LAST_RANK = 9;

type Standing = Pick<AgendaEntry, 'status'> & Partial<Pick<AgendaEntry, 'confirmBefore' | 'cancelledBy'>>;

/**
 * Keeps the agenda from the facts of the appointments of this context. Every fact but a move
 * carries the whole entry it leaves, so a fact applied twice or late ends on the same entry;
 * a move changes the place and keeps where the appointment stands.
 */
@Projection('scheduling.agenda', [Agenda])
export class AgendaProjection {
  constructor(private readonly agenda: Agenda) {}

  @On(AppointmentBooked, { name: 'scheduling.appointment.booked' })
  async booked(event: AppointmentBooked): Promise<ReadModelWrite> {
    const { booking, confirmBefore } = event.held;

    return this.stands(event, booking, confirmBefore === undefined ? { status: 'booked' } : { status: 'requested', confirmBefore });
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
    const entry: AgendaEntry = { ...placeOf(booking), id: event.aggregateId, confirmBefore: null, cancelledBy: null, ...standing, changedAt: event.occurredAt };

    return this.agenda.upsertIfNewer(event.aggregateId, stampOfFact(event), () => entry);
  }
}

function placeOf(booking: Booking): Omit<AgendaEntry, 'id' | 'status' | 'confirmBefore' | 'cancelledBy' | 'changedAt'> {
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
