import { unwrap } from '@ddd-ts-kit/kernel';
import { Appointment, type AppointmentState } from '../../domain/aggregates/appointment.aggregate.js';
import { Booking } from '../../domain/value-objects/booking.vo.js';
import { Cancellation } from '../../domain/value-objects/cancellation.vo.js';
import { Slot } from '../../domain/value-objects/slot.vo.js';
import type { AppointmentColumns, AppointmentRow } from './appointment-row.schema.js';

export const AppointmentMapper = {
  toDomain(row: AppointmentRow): Appointment {
    const loaded = Appointment.rehydrate(row.id, stateOf(row));

    loaded.version = row.version;

    return loaded;
  },

  toRow(saved: Appointment): AppointmentColumns {
    const { registeredAt, changedAt, booking, status, confirmBefore, cancellation } = saved.toState();

    return {
      id: saved.id,
      registered_at: registeredAt,
      changed_at: changedAt,
      calendar_id: booking.calendarId,
      practice_id: booking.practiceId,
      practitioner_id: booking.practitionerId,
      patient_id: booking.patientId,
      appointment_type_id: booking.appointmentTypeId,
      starts_at: booking.slot.startsAt,
      ends_at: booking.slot.endsAt,
      held_until: booking.slot.heldUntil,
      day: booking.day,
      status,
      confirm_before: confirmBefore ?? null,
      cancelled_by: cancellation?.by ?? null,
      cancellation_reason: cancellation?.reason ?? null,
    };
  },
};

function stateOf(row: AppointmentRow): AppointmentState {
  const booking = unwrap(
    Booking.create({
      calendarId: row.calendar_id,
      practiceId: row.practice_id,
      practitionerId: row.practitioner_id,
      patientId: row.patient_id,
      appointmentTypeId: row.appointment_type_id,
      slot: Slot.between(row.starts_at, row.ends_at, row.held_until),
      day: row.day,
    }),
  );

  return {
    registeredAt: row.registered_at,
    changedAt: row.changed_at,
    booking,
    status: row.status,
    ...(row.confirm_before === null ? {} : { confirmBefore: row.confirm_before }),
    ...(row.cancelled_by === null
      ? {}
      : { cancellation: unwrap(Cancellation.create(row.cancelled_by, row.cancellation_reason ?? undefined)) }),
  };
}
