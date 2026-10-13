import { Appointment, type AppointmentState } from '@/contexts/scheduling/domain/aggregates/appointment.aggregate';
import { AttachedDocument } from '@/contexts/scheduling/domain/value-objects/attached-document.vo';
import { Booking } from '@/contexts/scheduling/domain/value-objects/booking.vo';
import { Cancellation } from '@/contexts/scheduling/domain/value-objects/cancellation.vo';
import { Slot } from '@/contexts/scheduling/domain/value-objects/slot.vo';
import type {
  AppointmentColumns,
  AppointmentRow,
} from '@/contexts/scheduling/infrastructure/persistence/appointment-row.schema';

export const AppointmentMapper = {
  toDomain(row: AppointmentRow): Appointment {
    const loaded = Appointment.rehydrate(row.id, stateOf(row));

    loaded.version = row.version;

    return loaded;
  },

  toRow(saved: Appointment): AppointmentColumns {
    const { registeredAt, changedAt, booking, status, confirmBefore, cancellation, internalNote, document } =
      saved.toState();

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
      internal_note: internalNote ?? null,
      ...documentColumnsOf(document),
    };
  },
};

type DocumentColumns = Pick<
  AppointmentColumns,
  | 'document_key'
  | 'document_size'
  | 'document_media_type'
  | 'document_checksum'
  | 'document_name'
  | 'document_attached_at'
>;

const NO_DOCUMENT: DocumentColumns = {
  document_key: null,
  document_size: null,
  document_media_type: null,
  document_checksum: null,
  document_name: null,
  document_attached_at: null,
};

function documentColumnsOf(document: AttachedDocument | undefined): DocumentColumns {
  if (document === undefined) {
    return NO_DOCUMENT;
  }

  const { file, name, attachedAt } = document;

  return {
    document_key: file.key,
    document_size: file.size,
    document_media_type: file.mediaType,
    document_checksum: file.checksum,
    document_name: name,
    document_attached_at: attachedAt,
  };
}

function stateOf(row: AppointmentRow): AppointmentState {
  const booking = Booking.create({
    calendarId: row.calendar_id,
    practiceId: row.practice_id,
    practitionerId: row.practitioner_id,
    patientId: row.patient_id,
    appointmentTypeId: row.appointment_type_id,
    slot: Slot.between(row.starts_at, row.ends_at, row.held_until),
    day: row.day,
  });

  return {
    registeredAt: row.registered_at,
    changedAt: row.changed_at,
    booking,
    status: row.status,
    ...(row.confirm_before === null ? {} : { confirmBefore: row.confirm_before }),
    ...(row.cancelled_by === null
      ? {}
      : { cancellation: Cancellation.create(row.cancelled_by, row.cancellation_reason ?? undefined) }),
    ...documentOf(row),
    ...(row.internal_note === null ? {} : { internalNote: row.internal_note }),
  };
}

function documentOf(row: AppointmentRow): Pick<AppointmentState, 'document'> {
  if (row.document_key === null || row.document_attached_at === null) {
    return {};
  }

  const file = {
    key: row.document_key,
    size: row.document_size ?? 0,
    mediaType: row.document_media_type ?? 'application/octet-stream',
    checksum: row.document_checksum ?? '',
  };

  return { document: AttachedDocument.create(file, row.document_name ?? '', row.document_attached_at) };
}
